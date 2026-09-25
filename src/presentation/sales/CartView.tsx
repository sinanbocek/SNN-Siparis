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
import { parseQtyInput } from "../../domain/input/parse.ts";
import { fmtAmount, fmtMoney, fmtMoneyText, fmtRate } from "../parts/format.ts";
import { Icon, RateField, Stepper } from "../parts/parts.tsx";
import styles from "./sales.module.css";

interface Props {
  catalog: Catalog;
  cart: Cart;
  summary: CartSummary;
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
  onCartChange,
  onClear,
  onCheckout,
  onGoCatalog,
}: Props) {
  if (summary.lines.length === 0) {
    return (
      <section className={styles.page}>
        <div className={styles.emptyCart}>
          <h2>Sepet boş</h2>
          <p>Katalogdan adet girin; burada eczacının ödeyeceği ve kazanacağı tutar görünür.</p>
          <button type="button" className={styles.primary} onClick={onGoCatalog}>
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
          <b className="num">{fmtMoneyText(summary.netMinor)}</b>
        </div>
        <div>
          <span>Kazanırsınız</span>
          <b className={`num ${styles.goodText}`}>{fmtMoneyText(summary.pharmacistProfitMinor)}</b>
        </div>
        <em>{fmtRate(summary.pharmacistRate)}</em>
      </div>

      <div className={styles.cartLayout}>
        <div className={styles.cartTableWrap}>
          <div className={styles.cartTable} role="table" aria-label="Sepet satırları">
            <div className={`${styles.cartRow} ${styles.cartHead}`} role="row">
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
            <dt>Toplam (KDV hariç)</dt>
            <dd className="num">{fmtMoney(summary.netMinor)}</dd>
            {summary.vatGroups.map((g) => (
              <div key={g.rate} className={styles.totalsRow}>
                <dt>KDV ({fmtRate(g.rate, 0)})</dt>
                <dd className="num">{fmtMoney(g.vatMinor)}</dd>
              </div>
            ))}
            <dt className={styles.grand}>Genel toplam (KDV dahil)</dt>
            <dd className={`num ${styles.grand}`}>{fmtMoney(summary.grossMinor)}</dd>
          </dl>

          <div className={styles.cartActions}>
            <button type="button" className={styles.ghost} onClick={onClear}>
              <Icon icon={Delete02Icon} size={18} /> Sepeti temizle
            </button>
            <button type="button" className={styles.primary} onClick={onCheckout}>
              Siparişi tamamla →
            </button>
          </div>
        </div>

        <aside className={styles.panel} aria-label="Eczane kazancı">
          <h2>Eczane kazancı</h2>
          <div className={styles.panelItem}>
            <span>Ödeyeceğiniz (KDV hariç)</span>
            <b className="num">{fmtMoneyText(summary.netMinor)}</b>
          </div>
          <div className={styles.panelItem}>
            <span>Rafta satınca</span>
            <b className="num">{fmtMoneyText(summary.shelfRevenueMinor)}</b>
          </div>
          <div className={`${styles.panelItem} ${styles.panelProfit}`}>
            <span>Kazancınız</span>
            <b className="num">{fmtMoneyText(summary.pharmacistProfitMinor)}</b>
            <em>{fmtRate(summary.pharmacistRate)}</em>
          </div>
          {summary.mfTotal > 0 && (
            <p className={styles.mfInfo}>
              <Icon icon={GiftIcon} size={18} />+{summary.mfTotal} kutu MF · rafta{" "}
              {fmtMoneyText(summary.mfShelfValueMinor)} değerinde
            </p>
          )}
          <div className={styles.markup}>
            <span>Eczacı kârı</span>
            <div className={styles.markupStepper}>
              <button
                type="button"
                aria-label="Eczacı kârını azalt"
                onClick={() => changeMarkup(-MARKUP_STEP)}
              >
                <Icon icon={MinusSignIcon} size={18} />
              </button>
              <b className="num">{fmtRate(markup, 0)}</b>
              <button
                type="button"
                aria-label="Eczacı kârını artır"
                onClick={() => changeMarkup(MARKUP_STEP)}
              >
                <Icon icon={PlusSignIcon} size={18} />
              </button>
            </div>
          </div>
          {cart.markupOverride !== null && (
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => onCartChange({ ...cart, markupOverride: null })}
            >
              Varsayılana dön
            </button>
          )}
          <div className={styles.panelFoot}>
            <span>Raf fiyatı (KDV dahil)</span>
            <span className="num">{fmtMoneyText(summary.shelfGrossMinor)}</span>
          </div>
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
      <span role="cell" className={styles.cartName}>
        <b>{line.label}</b>
        <button
          type="button"
          className={styles.psfButton}
          onClick={() => setEditPsf((v) => !v)}
          aria-expanded={editPsf}
        >
          PSF {fmtAmount(line.psfMinor)}
          {line.markupOverride !== null && ` · ${fmtRate(line.markupOverride, 1)}`}
        </button>
        {line.priceChanged && <span className={styles.badge}>fiyat güncellendi</span>}
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
      <span role="cell" className="num">
        {fmtAmount(line.unitMinor)}
      </span>
      <span role="cell" className={styles.center}>
        <Stepper compact value={line.qty} label={line.label} onChange={onQty} />
      </span>
      <span role="cell" className={styles.center}>
        <MfInput value={line.mf} fromRule={line.mfFromRule} label={line.label} onCommit={onMf} />
      </span>
      <span role="cell" className="num">
        {fmtAmount(line.amountMinor)}
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
      onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 4))}
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
