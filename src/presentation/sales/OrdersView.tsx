import {
  Delete02Icon,
  Download04Icon,
  Edit02Icon,
  RefreshIcon,
  Search01Icon,
  WhatsappIcon,
} from "@hugeicons/core-free-icons";
import { useMemo, useRef, useState } from "react";
import type { PngRenderer, ShareService } from "../../application/ports/devices.ts";
import { filterOrders, type OrderFilter } from "../../application/session.ts";
import { orderFileName, type Order } from "../../domain/order/order.ts";
import { fmtMoney, fmtStamp } from "../parts/format.ts";
import { Icon, Modal } from "../parts/parts.tsx";
import { ScaledSheet } from "./ScaledSheet.tsx";
import styles from "./sales.module.css";

interface Props {
  orders: readonly Order[];
  today: string;
  nowIso: string;
  share: ShareService;
  png: PngRenderer;
  onReshared: (order: Order) => void;
  /** Tekrar sipariş: satırlar güncel fiyatlarla yeni sepete (PRD §4-E). */
  onCopyToCart: (order: Order) => void;
  /** Düzenle: sipariş aynı numarayla sepete açılır. */
  onEdit: (order: Order) => void;
  onDelete: (order: Order) => void;
}

const FILTERS: readonly { id: OrderFilter; label: string }[] = [
  { id: "today", label: "Bugün" },
  { id: "week", label: "Bu hafta" },
  { id: "all", label: "Tümü" },
];

export function OrdersView({
  orders,
  today,
  nowIso,
  share,
  png,
  onReshared,
  onCopyToCart,
  onEdit,
  onDelete,
}: Props) {
  const [filter, setFilter] = useState<OrderFilter>("all");
  const [query, setQuery] = useState("");
  const [openNo, setOpenNo] = useState<string | null>(null);
  const list = useMemo(
    () => filterOrders(orders, filter, query, today),
    [orders, filter, query, today],
  );
  const open = orders.find((o) => o.no === openNo);

  const confirmDelete = (order: Order) => {
    if (!window.confirm(`${order.pharmacy.name} · ${order.no} silinsin mi? Geri alınamaz.`)) {
      return;
    }
    onDelete(order);
    setOpenNo(null);
  };

  return (
    <section className={styles.page} aria-label="Siparişler">
      <div className={styles.ordersHead}>
        <label className={styles.search}>
          <Icon icon={Search01Icon} size={16} />
          <input
            type="search"
            placeholder="Eczane ara"
            aria-label="Eczane ara"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="tabs" role="group" aria-label="Dönem">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <p className={`card ${styles.empty}`}>
          {orders.length === 0 ? "Henüz sipariş yok." : "Bu süzgece uyan sipariş yok."}
        </p>
      ) : (
        <ul className={`card ${styles.orderList}`}>
          {list.map((o) => (
            <li key={o.no}>
              <button type="button" className={styles.orderOpen} onClick={() => setOpenNo(o.no)}>
                <span className={styles.orderMain}>
                  <b>{o.pharmacy.name}</b>
                  <span>
                    {o.no} · {fmtStamp(o.createdAt, nowIso)}
                    {o.updatedAt !== undefined && ` · düzenlendi ${fmtStamp(o.updatedAt, nowIso)}`}
                  </span>
                </span>
                <span className={styles.orderSide}>
                  <b>{fmtMoney(o.grossMinor)}</b>
                  <span
                    className={o.status === "shared" ? styles.statusShared : styles.statusReady}
                  >
                    {o.status === "shared" ? "Paylaşıldı" : "Hazır"}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className={styles.rowIcon}
                aria-label={`${o.no} sil`}
                onClick={() => confirmDelete(o)}
              >
                <Icon icon={Delete02Icon} size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <OrderDetail
          order={open}
          nowIso={nowIso}
          share={share}
          png={png}
          onReshared={onReshared}
          onCopyToCart={(o) => {
            onCopyToCart(o);
            setOpenNo(null);
          }}
          onEdit={(o) => {
            onEdit(o);
            setOpenNo(null);
          }}
          onDelete={confirmDelete}
          onClose={() => setOpenNo(null)}
        />
      )}
    </section>
  );
}

function OrderDetail({
  order,
  nowIso,
  share,
  png,
  onReshared,
  onCopyToCart,
  onEdit,
  onDelete,
  onClose,
}: {
  order: Order;
  nowIso: string;
  share: ShareService;
  png: PngRenderer;
  onReshared: (order: Order) => void;
  onCopyToCart: (order: Order) => void;
  onEdit: (order: Order) => void;
  onDelete: (order: Order) => void;
  onClose: () => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const produce = async () => {
    if (!sheetRef.current) return null;
    try {
      return await png.render(sheetRef.current);
    } catch {
      setMessage("Resim üretilemedi.");
      return null;
    }
  };

  const reshare = async () => {
    // P7: aynı sipariş ikinci kez — uyarı, aynı sipariş no.
    if (
      order.shareCount > 0 &&
      !window.confirm("Bu sipariş daha önce paylaşıldı. Yine paylaşılsın mı?")
    ) {
      return;
    }
    setBusy(true);
    const blob = await produce();
    if (blob) {
      const outcome = await share.sharePng(blob, orderFileName(order), order.headerTitle);
      if (outcome.kind === "shared" || outcome.kind === "fallback") onReshared(order);
      if (outcome.kind === "fallback") setMessage("Resim indirildi; WhatsApp Web açıldı.");
      if (outcome.kind === "failed") setMessage(outcome.message);
    }
    setBusy(false);
  };

  const download = async () => {
    setBusy(true);
    const blob = await produce();
    if (blob) share.download(blob, orderFileName(order));
    setBusy(false);
  };

  return (
    <Modal title={`${order.pharmacy.name} · ${order.no}`} onClose={onClose} wide>
      <div className={styles.checkout}>
        <div className={styles.checkoutForm}>
          <p className="hint">
            {fmtStamp(order.createdAt, nowIso)}
            {order.shareCount > 0 ? ` · ${order.shareCount} kez paylaşıldı` : " · paylaşılmadı"}
          </p>
          {message !== null && <p className={styles.formMessage}>{message}</p>}
          <div className={styles.detailActions}>
            <button
              type="button"
              className={`btnPrimary ${styles.whatsapp}`}
              disabled={busy}
              onClick={reshare}
            >
              <Icon icon={WhatsappIcon} /> Yeniden paylaş
            </button>
            <button type="button" className="btn" disabled={busy} onClick={download}>
              <Icon icon={Download04Icon} size={16} /> PNG indir
            </button>
            <button type="button" className="btn" onClick={() => onEdit(order)}>
              <Icon icon={Edit02Icon} size={16} /> Düzenle
            </button>
            <button type="button" className="btn" onClick={() => onCopyToCart(order)}>
              <Icon icon={RefreshIcon} size={16} /> Yeni sepete kopyala
            </button>
            <button type="button" className="btnDanger" onClick={() => onDelete(order)}>
              <Icon icon={Delete02Icon} size={16} /> Sil
            </button>
          </div>
          <p className="hint">
            Düzenle: sipariş aynı numarayla sepete açılır, güncel fiyatlar kullanılır; paylaşınca
            kayıt güncellenir. Yeni sepete kopyala: yeni numarayla yeni sipariş.
          </p>
        </div>
        <div className={styles.checkoutPreview}>
          <ScaledSheet order={order} sheetRef={sheetRef} />
        </div>
      </div>
    </Modal>
  );
}
