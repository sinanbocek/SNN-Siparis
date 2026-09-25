import {
  GridViewIcon,
  Settings02Icon,
  ShoppingBasket01Icon,
  Task01Icon,
} from "@hugeicons/core-free-icons";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PngRenderer, ImageResizer, ShareService } from "../../application/ports/devices.ts";
import type {
  DocumentStore,
  ImageMap,
  Meta,
  SalesStores,
  StoreError,
} from "../../application/ports/stores.ts";
import { istanbulDay, knownPharmacies } from "../../application/session.ts";
import { EMPTY_CART, pruneCart, setQty, summarizeCart, type Cart } from "../../domain/cart/cart.ts";
import { findVariant, type Catalog, type Variant } from "../../domain/catalog/catalog.ts";
import { buildOrder, markShared, nextOrderNo, type Order } from "../../domain/order/order.ts";
import type { Settings } from "../../domain/settings/settings.ts";
import { Banner, Icon } from "../parts/parts.tsx";
import { CartView } from "../sales/CartView.tsx";
import { CatalogView, type CatalogMode } from "../sales/CatalogView.tsx";
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

const VIEW_KEY = "snn-siparis.ui.catalog-mode";

function readMode(): CatalogMode {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "list" ? "list" : "cards";
  } catch {
    return "cards";
  }
}

export function App({ stores, seed, share, png, resizer, updates, now, admin }: AppProps) {
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
  const [mode, setMode] = useState<CatalogMode>(readMode);
  const [checkout, setCheckout] = useState<{ no: string; createdAt: string } | null>(null);
  const [resume, setResume] = useState(initial.cart.value.lines.length > 0);
  const [undo, setUndo] = useState<Cart | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const undoTimer = useRef<number | undefined>(undefined);

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
  const today = istanbulDay(now());

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
    setToast("Katalogdan kaldırılan ürünler sepetten çıkarıldı.");
  }, [dropped, cart, updateCart]);

  useEffect(() => {
    if (toast === null) return undefined;
    const t = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const onSetQty = (variant: Variant, qty: number) => {
    setResume(false);
    updateCart(setQty(cart, variant, qty));
  };

  const clearCart = () => {
    if (!window.confirm("Sepet temizlensin mi?")) return;
    setUndo(cart);
    updateCart(EMPTY_CART);
    window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setUndo(null), 10_000);
  };

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
      },
      summary,
    );
  }, [checkout, cart.pharmacy, cart.note, settings, summary]);

  const openCheckout = () => {
    const createdAt = now();
    setCheckout({
      no: nextOrderNo(settings.orderPrefix, istanbulDay(createdAt), orders),
      createdAt,
    });
  };

  const saveOrders = (next: readonly Order[]) => {
    setOrders(next);
    persist(stores.orders, next);
  };

  const onShared = (order: Order) => {
    const existing = orders.find((o) => o.no === order.no);
    const shared = markShared(existing ?? order);
    saveOrders(
      existing ? orders.map((o) => (o.no === order.no ? shared : o)) : [...orders, shared],
    );
    if (!existing) {
      updateCart(EMPTY_CART);
      setCheckout(null);
      setView("catalog");
      setToast(`${order.no} paylaşıldı. Sepet yeni eczane için boşaltıldı.`);
    }
  };

  const copyToCart = (order: Order) => {
    if (cart.lines.length > 0 && !window.confirm("Açık sepet bu siparişle değiştirilsin mi?"))
      return;
    let next: Cart = { ...EMPTY_CART, pharmacy: order.pharmacy, note: "" };
    let missing = 0;
    for (const line of order.lines) {
      const variant = findVariant(catalog, line.variantId);
      if (!variant || !variant.active || variant.saleMinor === null) {
        missing += 1;
        continue;
      }
      next = setQty(next, variant, line.qty);
    }
    updateCart(next);
    setView("cart");
    setToast(
      missing > 0
        ? `${missing} ürün artık katalogda yok; kalanlar güncel fiyatla sepete alındı.`
        : "Sipariş güncel fiyatlarla sepete alındı.",
    );
  };

  const changeMode = (next: CatalogMode) => {
    setMode(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* görünüm tercihi yalnız kolaylık */
    }
  };

  const cartCount = summary.lines.length;
  const unavailable = storeError === "unavailable";

  return (
    <div className={styles.shell}>
      <header className={styles.top}>
        <span className={styles.brand}>{settings.repName}</span>
        <nav className={styles.nav} aria-label="Ana gezinme">
          <NavButton
            current={view}
            id="catalog"
            label="Katalog"
            icon={GridViewIcon}
            onGo={setView}
          />
          <NavButton
            current={view}
            id="cart"
            label="Sepet"
            icon={ShoppingBasket01Icon}
            onGo={setView}
            badge={cartCount}
          />
          <NavButton
            current={view}
            id="orders"
            label="Siparişler"
            icon={Task01Icon}
            onGo={setView}
          />
        </nav>
        <button
          type="button"
          className={view === "admin" ? `${styles.gear} ${styles.gearOn}` : styles.gear}
          aria-label="Yönetim"
          onClick={() => setView("admin")}
        >
          <Icon icon={Settings02Icon} size={22} />
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
      {resume && view !== "admin" && (
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
      {undo !== null && (
        <Banner
          tone="warn"
          action={
            <button
              type="button"
              onClick={() => {
                updateCart(undo);
                setUndo(null);
              }}
            >
              Geri al
            </button>
          }
        >
          Sepet temizlendi.
        </Banner>
      )}

      <main className={styles.main}>
        {view === "catalog" && (
          <CatalogView
            catalog={catalog}
            settings={settings}
            images={images}
            cart={cart}
            mode={mode}
            onModeChange={changeMode}
            onSetQty={onSetQty}
          />
        )}
        {view === "cart" && (
          <CartView
            catalog={catalog}
            cart={cart}
            summary={summary}
            onCartChange={updateCart}
            onClear={clearCart}
            onCheckout={openCheckout}
            onGoCatalog={() => setView("catalog")}
          />
        )}
        {view === "orders" && (
          <OrdersView
            orders={orders}
            today={today}
            share={share}
            png={png}
            onShared={onShared}
            onCopyToCart={copyToCart}
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
                onOrdersReplace: saveOrders,
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

      {view !== "admin" && view !== "cart" && cartCount > 0 && (
        <button type="button" className={styles.cartFab} onClick={() => setView("cart")}>
          <Icon icon={ShoppingBasket01Icon} /> Sepet · {cartCount} ürün
        </button>
      )}

      {toast !== null && (
        <div className={styles.toast} role="status">
          {toast}
        </div>
      )}

      {checkout !== null && draftOrder !== null && (
        <CheckoutDialog
          order={draftOrder}
          suggestions={knownPharmacies(orders)}
          share={share}
          png={png}
          onPharmacyChange={(pharmacy) => updateCart({ ...cart, pharmacy })}
          onNoteChange={(note) => updateCart({ ...cart, note })}
          onShared={onShared}
          onClose={() => setCheckout(null)}
        />
      )}
    </div>
  );
}

function NavButton({
  current,
  id,
  label,
  icon,
  onGo,
  badge,
}: {
  current: View;
  id: View;
  label: string;
  icon: typeof GridViewIcon;
  onGo: (view: View) => void;
  badge?: number;
}) {
  return (
    <button
      type="button"
      className={current === id ? `${styles.navButton} ${styles.navOn}` : styles.navButton}
      aria-current={current === id ? "page" : undefined}
      onClick={() => onGo(id)}
    >
      <Icon icon={icon} size={20} />
      <span>{label}</span>
      {badge !== undefined && badge > 0 && <b className={styles.badge}>{badge}</b>}
    </button>
  );
}
