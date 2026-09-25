import {
  Download04Icon,
  RefreshIcon,
  Search01Icon,
  WhatsappIcon,
} from "@hugeicons/core-free-icons";
import { useMemo, useRef, useState } from "react";
import type { PngRenderer, ShareService } from "../../application/ports/devices.ts";
import { filterOrders, type OrderFilter } from "../../application/session.ts";
import { orderFileName, type Order } from "../../domain/order/order.ts";
import { fmtDateTime, fmtMoney } from "../parts/format.ts";
import { Icon, Modal } from "../parts/parts.tsx";
import { ScaledSheet } from "./ScaledSheet.tsx";
import styles from "./sales.module.css";

interface Props {
  orders: readonly Order[];
  today: string;
  share: ShareService;
  png: PngRenderer;
  onShared: (order: Order) => void;
  /** Tekrar sipariş: satırlar güncel fiyatlarla yeni sepete (PRD §4-E). */
  onCopyToCart: (order: Order) => void;
}

const FILTERS: readonly { id: OrderFilter; label: string }[] = [
  { id: "today", label: "Bugün" },
  { id: "week", label: "Bu hafta" },
  { id: "all", label: "Tümü" },
];

export function OrdersView({ orders, today, share, png, onShared, onCopyToCart }: Props) {
  const [filter, setFilter] = useState<OrderFilter>("all");
  const [query, setQuery] = useState("");
  const [openNo, setOpenNo] = useState<string | null>(null);
  const list = useMemo(
    () => filterOrders(orders, filter, query, today),
    [orders, filter, query, today],
  );
  const open = orders.find((o) => o.no === openNo);

  return (
    <section className={styles.page} aria-label="Siparişler">
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Icon icon={Search01Icon} size={18} />
          <input
            type="search"
            placeholder="Eczane ara"
            aria-label="Eczane ara"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className={styles.segment} role="group" aria-label="Dönem">
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
        <p className={styles.empty}>
          {orders.length === 0 ? "Henüz sipariş yok." : "Bu süzgece uyan sipariş yok."}
        </p>
      ) : (
        <ul className={styles.orderList}>
          {list.map((o) => (
            <li key={o.no}>
              <button type="button" onClick={() => setOpenNo(o.no)}>
                <span className={styles.orderMain}>
                  <b>{o.pharmacy.name}</b>
                  <span className={styles.muted}>
                    {o.no} · {fmtDateTime(o.createdAt)}
                  </span>
                </span>
                <span className={styles.orderSide}>
                  <b className="num">{fmtMoney(o.grossMinor)}</b>
                  <span
                    className={o.status === "shared" ? styles.statusShared : styles.statusReady}
                  >
                    {o.status === "shared" ? "Paylaşıldı" : "Hazır"}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <OrderDetail
          order={open}
          share={share}
          png={png}
          onShared={onShared}
          onCopyToCart={(o) => {
            onCopyToCart(o);
            setOpenNo(null);
          }}
          onClose={() => setOpenNo(null)}
        />
      )}
    </section>
  );
}

function OrderDetail({
  order,
  share,
  png,
  onShared,
  onCopyToCart,
  onClose,
}: {
  order: Order;
  share: ShareService;
  png: PngRenderer;
  onShared: (order: Order) => void;
  onCopyToCart: (order: Order) => void;
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
      if (outcome.kind === "shared" || outcome.kind === "fallback") onShared(order);
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
          {order.shareCount > 0 && (
            <p className={styles.hint}>Daha önce {order.shareCount} kez paylaşıldı.</p>
          )}
          {message !== null && <p className={styles.formMessage}>{message}</p>}
          <div className={styles.shareButtons}>
            <button type="button" className={styles.whatsapp} disabled={busy} onClick={reshare}>
              <Icon icon={WhatsappIcon} /> Yeniden paylaş
            </button>
            <button type="button" className={styles.ghost} disabled={busy} onClick={download}>
              <Icon icon={Download04Icon} size={18} /> PNG indir
            </button>
            <button type="button" className={styles.ghost} onClick={() => onCopyToCart(order)}>
              <Icon icon={RefreshIcon} size={18} /> Yeni sepete kopyala
            </button>
          </div>
          <p className={styles.hint}>
            Yeni sepete kopyalanınca güncel fiyatlar kullanılır; bu siparişin fiyatları değişmez.
          </p>
        </div>
        <div className={styles.checkoutPreview}>
          <ScaledSheet order={order} sheetRef={sheetRef} />
        </div>
      </div>
    </Modal>
  );
}
