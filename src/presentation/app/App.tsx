import {
  GridViewIcon,
  Settings02Icon,
  ShoppingBasket01Icon,
  Task01Icon,
} from "@hugeicons/core-free-icons";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import type { PngRenderer, ImageResizer, ShareService } from "../../application/ports/devices.ts";
import type {
  DocumentStore,
  ImageMap,
  Meta,
  SalesStores,
  StoreError,
} from "../../application/ports/stores.ts";
import { istanbulDay, knownPharmacies } from "../../application/session.ts";
import { writeAllOrNothing } from "../../application/transaction.ts";
import { EMPTY_CART, pruneCart, setQty, summarizeCart, type Cart } from "../../domain/cart/cart.ts";
import {
  findVariant,
  variantLabel,
  type Catalog,
  type Variant,
} from "../../domain/catalog/catalog.ts";
import {
  buildOrder,
  markShared,
  nextOrderNo,
  removeOrder,
  upsertOrder,
  type Order,
} from "../../domain/order/order.ts";
import type { Settings } from "../../domain/settings/settings.ts";
import { FeedbackProvider, useFeedback } from "../parts/feedback.tsx";
import { Banner, Icon } from "../parts/parts.tsx";
import { CartView } from "../sales/CartView.tsx";
import { CatalogView } from "../sales/CatalogView.tsx";
import { CheckoutDialog } from "../sales/CheckoutDialog.tsx";
import { OrdersView } from "../sales/OrdersView.tsx";
import type { AdminGateProps } from "../admin/AdminGate.tsx";
import styles from "./app.module.css";

/** Yönetim ayrı parça olarak yüklenir; satış ekranları maliyet kodunu hiç taşımaz. */
const AdminGate = lazy(() => import("../admin/AdminGate.tsx"));

export interface UpdateSignal {
  subscribe(listener: (ready: boolean) => void): () => void;
  apply(): void;
}

export interface AppProps {
  stores: SalesStores;
  seed: { catalog: Catalog; settings: Settings; images: ImageMap };
  share: ShareService;
  png: PngRenderer;
  resizer: ImageResizer;
  updates: UpdateSignal;
  now: () => string;
  admin: Omit<AdminGateProps, "base">;
}

type View = "catalog" | "cart" | "orders" | "admin";

interface Loaded<T> {
  value: T;
  error: StoreError | null;
}

function loadOr<T>(store: DocumentStore<T>, fallback: T): Loaded<T> {
  const result = store.load();
  if (!result.ok) return { value: fallback, error: result.reason };
  if (result.value === null) {
    store.save(fallback);
    return { value: fallback, error: null };
  }
  return { value: result.value, error: null };
}

/** Sipariş satırlarını güncel fiyatlarla sepete koyar; katalogda olmayanları sayar. */
function cartFromOrder(catalog: Catalog, order: Order): { cart: Cart; missing: number } {
  let cart: Cart = { ...EMPTY_CART, pharmacy: order.pharmacy, note: order.note };
  let missing = 0;
  for (const line of order.lines) {
    const variant = findVariant(catalog, line.variantId);
    if (!variant || !variant.active || variant.saleMinor === null) {
      missing += 1;
      continue;
    }
    cart = setQty(cart, variant, line.qty);
    if (line.mf > 0) {
      cart = {
        ...cart,
        lines: cart.lines.map((l) =>
          l.variantId === variant.id ? { ...l, mfOverride: line.mf } : l,
        ),
      };
    }
  }
  return { cart, missing };
}

/** Kabuk + ortak onay/bildirim sağlayıcısı. */
export function App(props: AppProps) {
  return (
    <FeedbackProvider>
      <AppShell {...props} />
    </FeedbackProvider>
  );
}

function AppShell({ stores, seed, share, png, resizer, updates, now, admin }: AppProps) {
  const feedback = useFeedback();
  const initial = useMemo(() => {
    const installedAt = now();
    const meta = loadOr<Meta>(stores.meta, { installedAt, lastBackupAt: null });
    return {
      settings: loadOr(stores.settings, seed.settings),
      catalog: loadOr(stores.catalog, seed.catalog),
      images: loadOr<ImageMap>(stores.images, {}),
      cart: loadOr<Cart>(stores.cart, EMPTY_CART),
      orders: loadOr<readonly Order[]>(stores.orders, []),
      meta,
    };
  }, [stores, seed, now]);

  const [settings, setSettings] = useState(initial.settings.value);
  const [catalog, setCatalog] = useState(initial.catalog.value);
  const [userImages, setUserImages] = useState(initial.images.value);
  const [cart, setCart] = useState(initial.cart.value);
  const [orders, setOrders] = useState(initial.orders.value);
  const [meta, setMeta] = useState(initial.meta.value);
  const [storeError, setStoreError] = useState<StoreError | null>(
    [initial.settings, initial.catalog, initial.images, initial.cart, initial.orders, initial.meta]
      .map((l) => l.error)
      .find((e) => e !== null) ?? null,
  );
  const [view, setView] = useState<View>("catalog");
  const [checkout, setCheckout] = useState<{ no: string; createdAt: string } | null>(null);
  const [resume, setResume] = useState(initial.cart.value.lines.length > 0);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => updates.subscribe(setUpdateReady), [updates]);

  const persist = useCallback(<T,>(store: DocumentStore<T>, value: T): StoreError | null => {
    const result = store.save(value);
    if (!result.ok) {
      setStoreError(result.reason);
      return result.reason;
    }
    return null;
  }, []);

  const images = useMemo(() => ({ ...seed.images, ...userImages }), [seed.images, userImages]);
  const summary = useMemo(() => summarizeCart(catalog, settings, cart), [catalog, settings, cart]);
  const nowIso = now();
  const today = istanbulDay(nowIso);

  const updateCart = useCallback(
    (next: Cart) => {
      setCart(next);
      persist(stores.cart, next);
    },
    [persist, stores.cart],
  );

  // D7: silinen/gizlenen ürün sepetten düşer.
  const dropped = summary.droppedVariantIds;
  useEffect(() => {
    if (dropped.length === 0) return;
    updateCart(pruneCart(cart, dropped));
    feedback.toast({ text: "Katalogdan kaldırılan ürünler sepetten çıkarıldı.", tone: "info" });
  }, [dropped, cart, updateCart, feedback]);

  /**
   * Sepet değişikliği; bir ürün sepetten çıktıysa (adet 0) 10 sn "Geri al" bildirimi
   * (Baymard: silinen ürün geri alınabilmeli). Sepeti temizle kendi onayını kullanır.
   */
  const changeCart = (next: Cart) => {
    const removed = cart.lines.filter(
      (line) => !next.lines.some((n) => n.variantId === line.variantId),
    );
    updateCart(next);
    if (removed.length === 0) return;
    const previous = cart;
    const first = removed[0];
    const variant = first === undefined ? undefined : findVariant(catalog, first.variantId);
    const name =
      removed.length > 1
        ? `${removed.length} ürün`
        : variant
          ? variantLabel(catalog, variant)
          : "Ürün";
    feedback.toast({
      tone: "info",
      text: `${name} sepetten çıkarıldı.`,
      action: { label: "Geri al", onClick: () => updateCart(previous) },
    });
  };

  const onSetQty = (variant: Variant, qty: number) => {
    setResume(false);
    changeCart(setQty(cart, variant, qty));
  };

  const clearCart = async () => {
    const ok = await feedback.confirm({
      title: "Sepet temizlensin mi?",
      message: `${cart.lines.length} ürün sepetten çıkarılacak. 10 saniye içinde geri alabilirsiniz.`,
      confirmLabel: "Temizle",
      danger: true,
    });
    if (!ok) return;
    const previous = cart;
    updateCart(EMPTY_CART);
    feedback.toast({
      text: "Sepet temizlendi.",
      tone: "info",
      action: { label: "Geri al", onClick: () => updateCart(previous) },
    });
  };

  const editing = cart.editing === undefined ? null : cart.editing;

  const draftOrder = useMemo(() => {
    if (checkout === null) return null;
    return buildOrder(
      {
        no: checkout.no,
        createdAt: checkout.createdAt,
        day: istanbulDay(checkout.createdAt),
        pharmacy: cart.pharmacy,
        note: cart.note,
        repName: settings.repName,
        repPhone: settings.repPhone,
        headerTitle: settings.headerTitle,
        ...(editing !== null && { updatedAt: nowIso }),
      },
      summary,
    );
  }, [checkout, cart.pharmacy, cart.note, settings, summary, editing, nowIso]);

  const openCheckout = () => {
    if (editing !== null) {
      setCheckout({ no: editing.no, createdAt: editing.createdAt });
      return;
    }
    const createdAt = now();
    setCheckout({
      no: nextOrderNo(settings.orderPrefix, istanbulDay(createdAt), [
        ...orders.map((o) => o.no),
        ...(meta.lastOrderNo === undefined ? [] : [meta.lastOrderNo]),
      ]),
      createdAt,
    });
  };

  const saveOrders = (next: readonly Order[]) => {
    setOrders(next);
    persist(stores.orders, next);
  };

  /** Tamamla penceresinden paylaşıldı: yeni ya da düzenlenen sipariş kaydedilir, sepet boşalır. */
  const onCheckoutShared = (order: Order) => {
    const previous = orders.find((o) => o.no === order.no);
    const shared = markShared(previous ? { ...order, shareCount: previous.shareCount } : order);
    saveOrders(upsertOrder(orders, shared));
    if (!previous) {
      // Verilen numarayı sakla: sipariş sonradan silinse de bu numara yeniden verilmez.
      const nextMeta = { ...meta, lastOrderNo: order.no };
      setMeta(nextMeta);
      persist(stores.meta, nextMeta);
    }
    updateCart(EMPTY_CART);
    setCheckout(null);
    setView(previous ? "orders" : "catalog");
    feedback.toast({
      tone: "success",
      text: previous
        ? `${order.no} güncellendi ve paylaşıldı.`
        : `${order.no} paylaşıldı. Sepet yeni eczane için boşaltıldı.`,
    });
  };

  /** Geçmişten yeniden paylaşıldı: yalnız sayaç ve durum. */
  const onReshared = (order: Order) => {
    saveOrders(upsertOrder(orders, markShared(order)));
  };

  const loadOrderIntoCart = async (order: Order, asEdit: boolean) => {
    if (
      cart.lines.length > 0 &&
      !(await feedback.confirm({
        title: "Açık sepet değiştirilsin mi?",
        message: `Sepetteki ${cart.lines.length} ürün yerine ${order.no} açılacak.`,
        confirmLabel: "Değiştir",
      }))
    ) {
      return;
    }
    const { cart: next, missing } = cartFromOrder(catalog, order);
    updateCart(
      asEdit
        ? { ...next, editing: { no: order.no, createdAt: order.createdAt } }
        : { ...next, note: "" },
    );
    setResume(false);
    setView("cart");
    const lead = asEdit
      ? `${order.no} düzenleniyor; güncel fiyatlar kullanılır.`
      : "Sipariş güncel fiyatlarla sepete alındı.";
    feedback.toast({
      tone: "info",
      text: missing > 0 ? `${lead} ${missing} ürün artık katalogda yok.` : lead,
    });
  };

  const deleteOrder = (order: Order) => {
    saveOrders(removeOrder(orders, order.no));
    if (editing !== null && editing.no === order.no) {
      const { editing: _dropped, ...rest } = cart;
      updateCart(rest);
    }
    feedback.toast({ tone: "success", text: `${order.no} silindi.` });
  };

  const cartCount = summary.lines.length;
  const unavailable = storeError === "unavailable";

  const nav: readonly { id: View; label: string; icon: typeof GridViewIcon; badge?: number }[] = [
    { id: "catalog", label: "Katalog", icon: GridViewIcon },
    { id: "cart", label: "Sepet", icon: ShoppingBasket01Icon, badge: cartCount },
    { id: "orders", label: "Siparişler", icon: Task01Icon },
  ];

  return (
    <div className={styles.shell}>
      <header className={styles.top}>
        <div className={styles.brand}>
          <span className={styles.logo} aria-hidden="true">
            <Icon icon={ShoppingBasket01Icon} size={16} />
          </span>
          <span className={styles.brandText}>
            <b>SNN Sipariş</b>
            <small>{settings.repName}</small>
          </span>
        </div>
        <nav className={`tabs ${styles.nav}`} aria-label="Ana gezinme">
          {nav.map((n) => (
            <button
              key={n.id}
              type="button"
              aria-current={view === n.id ? "page" : undefined}
              onClick={() => setView(n.id)}
            >
              <Icon icon={n.icon} size={16} />
              <span>{n.label}</span>
              {n.badge !== undefined && n.badge > 0 && <b className={styles.badge}>{n.badge}</b>}
            </button>
          ))}
        </nav>
        <button
          type="button"
          className={view === "admin" ? `${styles.gear} ${styles.gearOn}` : styles.gear}
          aria-label="Yönetim"
          onClick={() => setView("admin")}
        >
          <Icon icon={Settings02Icon} size={18} />
        </button>
      </header>

      {unavailable && (
        <Banner tone="bad">
          Kaydedilmiyor: bu tarayıcıda depo kapalı (gizli sekme?). Sayfa kapanınca veri kaybolur.
        </Banner>
      )}
      {storeError === "corrupt" && (
        <Banner
          tone="warn"
          action={
            <button type="button" onClick={() => setStoreError(null)}>
              Tamam
            </button>
          }
        >
          Kayıtlı verinin bir kısmı okunamadı; başlangıç verisi kullanılıyor. Eski kayıt ayrı
          saklandı.
        </Banner>
      )}
      {storeError === "quota" && (
        <Banner
          tone="warn"
          action={
            <button type="button" onClick={() => setStoreError(null)}>
              Tamam
            </button>
          }
        >
          Cihazda yer kalmadı; son değişiklik kaydedilemedi. Görselleri azaltın.
        </Banner>
      )}
      {updateReady && (
        <Banner
          tone="info"
          action={
            <button type="button" onClick={() => updates.apply()}>
              Yenile
            </button>
          }
        >
          Yeni sürüm hazır. Sepet ve tüm veri korunur.
        </Banner>
      )}
      {editing !== null && view !== "admin" && (
        <Banner
          tone="info"
          action={
            <button
              type="button"
              onClick={async () => {
                const ok = await feedback.confirm({
                  title: "Düzenleme bırakılsın mı?",
                  message: "Sepet boşalır; kayıtlı sipariş değişmez.",
                  confirmLabel: "Bırak",
                });
                if (ok) updateCart(EMPTY_CART);
              }}
            >
              Düzenlemeyi bırak
            </button>
          }
        >
          {editing.no} düzenleniyor. Paylaşınca kayıt güncellenir.
        </Banner>
      )}
      {resume && editing === null && view !== "admin" && (
        <Banner
          tone="info"
          action={
            <span className={styles.bannerActions}>
              <button
                type="button"
                onClick={() => {
                  setResume(false);
                  setView("cart");
                }}
              >
                Devam et
              </button>
              <button
                type="button"
                onClick={() => {
                  setResume(false);
                  updateCart(EMPTY_CART);
                }}
              >
                Yeni başlat
              </button>
            </span>
          }
        >
          {cart.pharmacy.name.trim().length > 0
            ? `${cart.pharmacy.name} için açık sepet var.`
            : `Açık sepet var (${cart.lines.length} ürün).`}
        </Banner>
      )}
      <main className={styles.main}>
        {view === "catalog" && (
          <CatalogView
            catalog={catalog}
            settings={settings}
            images={images}
            cart={cart}
            onSetQty={onSetQty}
          />
        )}
        {view === "cart" && (
          <CartView
            catalog={catalog}
            cart={cart}
            summary={summary}
            editingNo={editing === null ? null : editing.no}
            onCartChange={changeCart}
            onClear={clearCart}
            onCheckout={openCheckout}
            onGoCatalog={() => setView("catalog")}
          />
        )}
        {view === "orders" && (
          <OrdersView
            orders={orders}
            today={today}
            nowIso={nowIso}
            share={share}
            png={png}
            onReshared={onReshared}
            onCopyToCart={(o) => loadOrderIntoCart(o, false)}
            onEdit={(o) => loadOrderIntoCart(o, true)}
            onDelete={deleteOrder}
          />
        )}
        {view === "admin" && (
          <Suspense fallback={<p className={styles.loading}>Yükleniyor…</p>}>
            <AdminGate
              {...admin}
              base={{
                catalog,
                settings,
                images,
                userImages,
                meta,
                orders,
                usageBytes: stores.usageBytes(),
                resizer,
                today,
                now,
                onCatalogChange: (next) => {
                  setCatalog(next);
                  persist(stores.catalog, next);
                },
                onSettingsChange: (next) => {
                  setSettings(next);
                  persist(stores.settings, next);
                },
                onImagesChange: async (next) => {
                  const error = persist(stores.images, next);
                  if (error === null) {
                    setUserImages(next);
                    return null;
                  }
                  return error === "quota"
                    ? "Cihazda yer kalmadı; görsel kaydedilemedi. Başka görseli kaldırın."
                    : "Görsel kaydedilemedi.";
                },
                applyBackup: (backup) => {
                  const images = backup.images;
                  const error = writeAllOrNothing([
                    {
                      write: () => stores.settings.save(backup.settings),
                      rollback: () => stores.settings.save(settings),
                    },
                    {
                      write: () => stores.catalog.save(backup.catalog),
                      rollback: () => stores.catalog.save(catalog),
                    },
                    {
                      write: () => stores.orders.save(backup.orders),
                      rollback: () => stores.orders.save(orders),
                    },
                    ...(images === null
                      ? []
                      : [
                          {
                            write: () => stores.images.save(images),
                            rollback: () => stores.images.save(userImages),
                          },
                        ]),
                  ]);
                  if (error !== null) {
                    return error === "quota"
                      ? "Cihazda yer kalmadı; yedek yüklenmedi. Mevcut veri olduğu gibi korundu."
                      : "Yedek yüklenemedi. Mevcut veri olduğu gibi korundu.";
                  }
                  setSettings(backup.settings);
                  setCatalog(backup.catalog);
                  setOrders(backup.orders);
                  if (images !== null) setUserImages(images);
                  return null;
                },
                onMetaChange: (next) => {
                  setMeta(next);
                  persist(stores.meta, next);
                },
                onDownload: (blob, name) => share.download(blob, name),
                resetSeed: () => {
                  setCatalog(seed.catalog);
                  persist(stores.catalog, seed.catalog);
                  setUserImages({});
                  persist(stores.images, {});
                },
                onExit: () => setView("catalog"),
              }}
            />
          </Suspense>
        )}
      </main>

      {view === "catalog" && cartCount > 0 && (
        <button type="button" className={styles.cartFab} onClick={() => setView("cart")}>
          <Icon icon={ShoppingBasket01Icon} size={16} /> Sepet · {cartCount} ürün
        </button>
      )}

      {checkout !== null && draftOrder !== null && (
        <CheckoutDialog
          order={draftOrder}
          pharmacy={cart.pharmacy}
          note={cart.note}
          editing={editing !== null}
          suggestions={knownPharmacies(orders)}
          share={share}
          png={png}
          onPharmacyChange={(pharmacy) => updateCart({ ...cart, pharmacy })}
          onNoteChange={(note) => updateCart({ ...cart, note })}
          onShared={onCheckoutShared}
          onClose={() => setCheckout(null)}
        />
      )}
    </div>
  );
}
