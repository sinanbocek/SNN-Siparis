import { Delete02Icon, GiftIcon, MinusSignIcon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { math } from "@snn/abacus-core";
import { useState } from "react";
import {
  MAX_QTY,
  setQty,
  updateLine,
  type Cart,
  type CartSummary,
  type LineSummary,
} from "../../domain/cart/cart.ts";
import { findVariant, type Catalog } from "../../domain/catalog/catalog.ts";
import { parseQtyInput, qtyInput } from "../../domain/input/parse.ts";
import { fmtMoney, fmtRate } from "../parts/format.ts";
import { Icon, RateField, Stepper } from "../parts/parts.tsx";
import styles from "./sales.module.css";

interface Props {
  catalog: Catalog;
  cart: Cart;
  summary: CartSummary;
  editingNo: string | null;
  onCartChange: (cart: Cart) => void;
  onClear: () => void;
  onCheckout: () => void;
  onGoCatalog: () => void;
}

const MARKUP_STEP = 0.01;

/** Sepet (karar E2 A): solda tablo, sağda Eczane Kazancı; telefonda üstte kazanç şeridi (S8). */
export function CartView({
  catalog,
  cart,
  summary,
  editingNo,
  onCartChange,
  onClear,
  onCheckout,
  onGoCatalog,
}: Props) {
  if (summary.lines.length === 0) {
    return (
      <section className={styles.page}>
        <div className={`card ${styles.emptyCart}`}>
          <h2>Sepet boş</h2>
          <p>Katalogdan adet girin; burada eczacının ödeyeceği ve kazanacağı tutar görünür.</p>
          <button type="button" className="btnPrimary" onClick={onGoCatalog}>
            Kataloğa git
          </button>
        </div>
      </section>
    );
  }

  const setLineQty = (variantId: string, qty: number) => {
    const variant = findVariant(catalog, variantId);
    if (variant) onCartChange(setQty(cart, variant, qty));
  };

  const markup = summary.markupInEffect;
  const changeMarkup = (delta: number) => {
    const next = math.round(math.add(markup, delta), 4);
    if (next < 0 || next > 3) return;
    onCartChange({ ...cart, markupOverride: next });
  };

  return (
    <section className={styles.page} aria-label="Sepet">
      <div className={styles.strip} aria-label="Eczane kazancı özeti">
        <div>
          <span>Ödersiniz</span>
          <b className="num">{fmtMoney(summary.netMinor)}</b>
        </div>
        <div>
          <span>Kazanırsınız · {fmtRate(summary.pharmacistRate)}</span>
          <b className={`num ${styles.goodText}`}>{fmtMoney(summary.pharmacistProfitMinor)}</b>
        </div>
      </div>

      <div className={styles.cartLayout}>
        <div className={`card ${styles.cartCard}`}>
          <div className={styles.cardHead}>
            <h2>Sepet</h2>
            <span className={styles.muted}>
              {editingNo !== null ? `${editingNo} düzenleniyor · ` : ""}
              {`${summary.lines.length} ürün · ${summary.qtyTotal} kutu`}
              {summary.mfTotal > 0 ? ` + ${summary.mfTotal} MF` : ""}
            </span>
          </div>
          <div role="table" aria-label="Sepet satırları">
            <div className={`${styles.cartRow} ${styles.head}`} role="row">
              <span role="columnheader">Ürün</span>
              <span role="columnheader" className="num">
                Birim
              </span>
              <span role="columnheader" className={styles.center}>
                Adet
              </span>
              <span role="columnheader" className={styles.center}>
                MF
              </span>
              <span role="columnheader" className="num">
                Tutar
              </span>
            </div>
            {summary.lines.map((line) => (
              <CartLineRow
                key={line.variantId}
                line={line}
                onQty={(qty) => setLineQty(line.variantId, qty)}
                onMf={(mf) =>
                  onCartChange(
                    updateLine(cart, line.variantId, {
                      mfOverride: mf === line.mfFromRule ? null : mf,
                    }),
                  )
                }
                onMarkup={(rate) =>
                  onCartChange(updateLine(cart, line.variantId, { markupOverride: rate }))
                }
              />
            ))}
          </div>

          <dl className={styles.totals}>
            <div>
              <dt>Toplam (KDV hariç)</dt>
              <dd className="num">{fmtMoney(summary.netMinor)}</dd>
            </div>
            {summary.vatGroups.map((g) => (
              <div key={g.rate}>
                <dt>KDV ({fmtRate(g.rate, 0)})</dt>
                <dd className="num">{fmtMoney(g.vatMinor)}</dd>
              </div>
            ))}
            <div className={styles.grand}>
              <dt>Genel toplam (KDV dahil)</dt>
              <dd className="num">{fmtMoney(summary.grossMinor)}</dd>
            </div>
          </dl>

          <div className={styles.cardFoot}>
            <button type="button" className="btn" onClick={onClear}>
              <Icon icon={Delete02Icon} size={16} /> Sepeti temizle
            </button>
            <button type="button" className="btnPrimary" onClick={onCheckout}>
              {editingNo !== null ? "Siparişi güncelle" : "Siparişi tamamla"}
            </button>
          </div>
        </div>

        <aside className={styles.offer} aria-label="Eczane kazancı">
          <p className={styles.offerLabel}>Eczane kazancı</p>
          <p className={styles.offerTotal}>{fmtMoney(summary.pharmacistProfitMinor)}</p>
          <p className={styles.offerRate}>
            Ödediğinin {fmtRate(summary.pharmacistRate)} kadarı kâr
          </p>
          <div className={styles.offerRows}>
            <div>
              <span>Ödeyeceğiniz (KDV hariç)</span>
              <b className="num">{fmtMoney(summary.netMinor)}</b>
            </div>
            <div>
              <span>Rafta satınca</span>
              <b className="num">{fmtMoney(summary.shelfRevenueMinor)}</b>
            </div>
            <div>
              <span>Raf fiyatı (KDV dahil)</span>
              <b className="num">{fmtMoney(summary.shelfGrossMinor)}</b>
            </div>
          </div>
          {summary.mfTotal > 0 && (
            <p className={styles.offerNote}>
              <Icon icon={GiftIcon} size={16} />+{summary.mfTotal} kutu MF · rafta{" "}
              {fmtMoney(summary.mfShelfValueMinor)} değerinde
            </p>
          )}
          <div className={styles.markupRow}>
            <span>Eczacı kârı</span>
            <div className={styles.markupStepper}>
              <button
                type="button"
                aria-label="Eczacı kârını azalt"
                onClick={() => changeMarkup(-MARKUP_STEP)}
              >
                <Icon icon={MinusSignIcon} size={16} />
              </button>
              <b className="num">{fmtRate(markup, 0)}</b>
              <button
                type="button"
                aria-label="Eczacı kârını artır"
                onClick={() => changeMarkup(MARKUP_STEP)}
              >
                <Icon icon={PlusSignIcon} size={16} />
              </button>
            </div>
          </div>
          {cart.markupOverride !== null && (
            <button
              type="button"
              className={styles.offerLink}
              onClick={() => onCartChange({ ...cart, markupOverride: null })}
            >
              Varsayılan orana dön
            </button>
          )}
        </aside>
      </div>
    </section>
  );
}

function CartLineRow({
  line,
  onQty,
  onMf,
  onMarkup,
}: {
  line: LineSummary;
  onQty: (qty: number) => void;
  onMf: (mf: number) => void;
  onMarkup: (rate: number | null) => void;
}) {
  const [editPsf, setEditPsf] = useState(false);
  return (
    <div className={styles.cartRow} role="row">
      <span role="cell" className={styles.name}>
        <b>{line.familyName}</b>
        <small>{line.variantName}</small>
        <span className={styles.lineMeta}>
          <button
            type="button"
            className={styles.psfButton}
            onClick={() => setEditPsf((v) => !v)}
            aria-expanded={editPsf}
          >
            PSF {fmtMoney(line.psfMinor)}
            {line.markupOverride !== null && ` · ${fmtRate(line.markupOverride, 1)}`}
          </button>
          <span className={styles.phoneUnit}>× {fmtMoney(line.unitMinor)}</span>
          {line.priceChanged && <span className={styles.badge}>fiyat güncellendi</span>}
        </span>
        {editPsf && (
          <span className={styles.psfEdit}>
            <RateField
              label={`${line.label} eczacı oranı`}
              value={line.markupOverride}
              placeholder="sepet oranı"
              onCommit={(rate) => onMarkup(rate)}
            />
          </span>
        )}
      </span>
      <span role="cell" className={`num ${styles.colUnit}`}>
        {fmtMoney(line.unitMinor)}
      </span>
      <span role="cell" className={styles.center}>
        <Stepper value={line.qty} label={line.label} onChange={onQty} />
      </span>
      <span role="cell" className={styles.center}>
        <MfInput value={line.mf} fromRule={line.mfFromRule} label={line.label} onCommit={onMf} />
      </span>
      <span role="cell" className={`num ${styles.amount}`}>
        {fmtMoney(line.amountMinor)}
      </span>
    </div>
  );
}

function MfInput({
  value,
  fromRule,
  label,
  onCommit,
}: {
  value: number;
  fromRule: number;
  label: string;
  onCommit: (mf: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === 0 ? "" : String(value));
  return (
    <input
      className={value !== fromRule ? `${styles.mfInput} ${styles.mfManual}` : styles.mfInput}
      aria-label={`${label} MF`}
      title={value !== fromRule ? `Kural: ${fromRule}` : "Kuraldan"}
      inputMode="numeric"
      placeholder="—"
      value={shown}
      onChange={(e) => setDraft(qtyInput(e.target.value))}
      onBlur={() => {
        if (draft !== null) {
          const parsed = parseQtyInput(draft);
          if (parsed !== null && parsed <= MAX_QTY) onCommit(parsed);
        }
        setDraft(null);
      }}
    />
  );
}
