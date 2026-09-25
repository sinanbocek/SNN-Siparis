import { forwardRef } from "react";
import { math } from "@snn/abacus-core";
import { phoneDisplay } from "../../domain/input/parse.ts";
import type { Order } from "../../domain/order/order.ts";
import { amountInWords, fmtMoney, fmtRate, fmtStamp } from "../parts/format.ts";
import styles from "./OrderSheet.module.css";

/**
 * Sipariş resmi (karar E3 B): 1080 px, gövde ≥ 28 px, telefonda yakınlaştırmadan okunur (P4).
 * Eczacı kazancı YER ALMAZ. Logo yerine boş çerçeve (karar: logo yok, yer tutucu).
 */
export const OrderSheet = forwardRef<HTMLDivElement, { order: Order }>(function OrderSheet(
  { order },
  ref,
) {
  const p = order.pharmacy;
  const place = [p.district, p.address].filter((s) => s.length > 0).join(" · ");
  return (
    <div ref={ref} className={styles.sheet}>
      <header className={styles.head}>
        <div className={styles.logo}>LOGO</div>
        <div className={styles.title}>
          <b>{order.headerTitle.length > 0 ? order.headerTitle : "Sipariş Formu"}</b>
          <span>{order.no}</span>
          <span>{fmtStamp(order.createdAt, order.createdAt)}</span>
        </div>
      </header>

      <section className={styles.pharmacy}>
        <b>{p.name}</b>
        {place.length > 0 && <span>{place}</span>}
        {p.phone.length > 0 && <span>Tel: {phoneDisplay(p.phone)}</span>}
      </section>

      <ol className={styles.lines}>
        {order.lines.map((l, i) => {
          const total = math.add(l.qty, l.mf);
          const qtyText = l.mf > 0 ? `${total} adet (${l.qty}+${l.mf} MF)` : `${l.qty} adet`;
          return (
            <li key={l.variantId}>
              <span className={styles.idx}>{i + 1}</span>
              <span className={styles.lineMain}>
                <b>{l.label}</b>
                <span>
                  {qtyText} × {fmtMoney(l.unitMinor)}
                </span>
              </span>
              <span className={styles.amount}>{fmtMoney(l.amountMinor)}</span>
            </li>
          );
        })}
      </ol>

      <dl className={styles.totals}>
        <dt>Toplam (KDV hariç)</dt>
        <dd>{fmtMoney(order.netMinor)}</dd>
        {order.vatGroups.map((g) => (
          <div key={g.rate} className={styles.row}>
            <dt>KDV ({fmtRate(g.rate, 0)})</dt>
            <dd>{fmtMoney(g.vatMinor)}</dd>
          </div>
        ))}
        <dt className={styles.grand}>Genel toplam</dt>
        <dd className={styles.grand}>{fmtMoney(order.grossMinor)}</dd>
      </dl>
      <p className={styles.words}>({amountInWords(order.grossMinor)})</p>

      {order.note.length > 0 && (
        <p className={styles.note}>
          <b>Not:</b> {order.note}
        </p>
      )}

      <footer className={styles.foot}>
        <span>
          Pazarlamacı: <b>{order.repName}</b> · {phoneDisplay(order.repPhone)}
        </span>
        <span>Fiyatlar KDV hariçtir.</span>
      </footer>
    </div>
  );
});
