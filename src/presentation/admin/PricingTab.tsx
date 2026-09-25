import { Alert02Icon, Calculator01Icon, CancelCircleIcon } from "@hugeicons/core-free-icons";
import { useMemo, useState } from "react";
import {
  applyCostEntry,
  bulkAdjust,
  costEntryOf,
  estimateMissingCosts,
  type PricingState,
} from "../../application/admin/pricing.ts";
import {
  effectiveMarkup,
  effectiveVat,
  familyOf,
  variantLabel,
  variantPsf,
  type Catalog,
  type MfRule,
  type PsfSetting,
  type Variant,
} from "../../domain/catalog/catalog.ts";
import {
  isRatePolicy,
  ourProfit,
  saleFromPolicy,
  type CostEntry,
  type ProfitPolicy,
  type ProfitPolicyKind,
} from "../../domain/costs/costs.ts";
import { parseQtyInput, qtyInput } from "../../domain/input/parse.ts";
import { markupFromPsf, priceWarnings, psfFromSale } from "../../domain/pricing/pricing.ts";
import type { Settings } from "../../domain/settings/settings.ts";
import { fmtMoney, fmtRate } from "../parts/format.ts";
import { useFeedback } from "../parts/feedback.tsx";
import { Icon, Modal, MoneyField, RateField } from "../parts/parts.tsx";
import styles from "./admin.module.css";

const POLICY_LABELS: Record<ProfitPolicyKind, string> = {
  markup: "Maliyete % ekle",
  margin: "Satıştan % marj",
  fixed_price: "Sabit satış fiyatı",
  target_profit: "Maliyete TL ekle",
};

interface Props {
  state: PricingState;
  settings: Settings;
  onChange: (state: PricingState) => void;
}

export function PricingTab({ state, settings, onChange }: Props) {
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [bulkRate, setBulkRate] = useState<number | null>(null);
  const [bulkAmount, setBulkAmount] = useState<number | null>(null);
  const rows = useMemo(
    () =>
      [...state.catalog.variants].sort((a, b) => {
        const fa = familyOf(state.catalog, a);
        const fb = familyOf(state.catalog, b);
        return (fa ? fa.order : 0) - (fb ? fb.order : 0) || a.order - b.order;
      }),
    [state.catalog],
  );
  const step = settings.roundingStepMinor;
  const allIds = rows.map((r) => r.id);
  const target = selected.length > 0 ? selected : allIds;
  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const editVariant = rows.find((r) => r.id === editing);

  return (
    <div className={styles.tab}>
      <div className={styles.bulkBar}>
        <span className={styles.bulkCount}>
          {selected.length > 0 ? `${selected.length} ürün seçili` : "Tüm ürünler"}
        </span>
        <div className={styles.bulkGroup}>
          <RateField label="Toplu yüzde" value={bulkRate} onCommit={setBulkRate} placeholder="+5" />
          <button
            type="button"
            className="btn"
            disabled={bulkRate === null}
            onClick={() => {
              if (bulkRate === null) return;
              onChange(bulkAdjust(state, target, { kind: "percent", rate: bulkRate }, step));
              setBulkRate(null);
            }}
          >
            % uygula
          </button>
        </div>
        <div className={styles.bulkGroup}>
          <MoneyField
            label="Toplu tutar"
            value={bulkAmount}
            onCommit={setBulkAmount}
            placeholder="TL"
          />
          <button
            type="button"
            className="btn"
            disabled={bulkAmount === null}
            onClick={() => {
              if (bulkAmount === null) return;
              onChange(
                bulkAdjust(state, target, { kind: "amount", amountMinor: bulkAmount }, step),
              );
              setBulkAmount(null);
            }}
          >
            TL ekle
          </button>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => onChange(estimateMissingCosts(state, target))}
        >
          <Icon icon={Calculator01Icon} size={18} /> %40 marjdan tahmin et
        </button>
        {selected.length > 0 && (
          <button type="button" className={styles.link} onClick={() => setSelected([])}>
            Seçimi kaldır
          </button>
        )}
      </div>
      <p className={styles.note}>
        Toplu değişiklik sonucu yuvarlama adımına ({fmtMoney(step)}) yuvarlanır ve sabit fiyat olur.
        Tahmin yalnız maliyeti boş ürünlere yazılır.
      </p>

      <div className={styles.tableWrap}>
        <table className={`${styles.table} ${styles.stack}`}>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label="Tümünü seç"
                  checked={selected.length === allIds.length}
                  onChange={(e) => setSelected(e.target.checked ? allIds : [])}
                />
              </th>
              <th>Ürün</th>
              <th className="num">Maliyet</th>
              <th>Kâr modu</th>
              <th className="num">Satış</th>
              <th className="num">Bizim kâr</th>
              <th className="num">PSF</th>
              <th className="num">Eczacı</th>
              <th>MF</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => {
              const entry = costEntryOf(state.costs, v);
              const psf = variantPsf(v, settings);
              const warnings =
                v.saleMinor !== null && psf !== null ? priceWarnings(v.saleMinor, psf) : [];
              const markup =
                v.saleMinor !== null && psf !== null ? markupFromPsf(v.saleMinor, psf) : null;
              return (
                <tr
                  key={v.id}
                  className={v.active ? undefined : styles.inactive}
                  onClick={() => setEditing(v.id)}
                >
                  <td className={styles.cellSelect} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`${variantLabel(state.catalog, v)} seç`}
                      checked={selected.includes(v.id)}
                      onChange={() => toggle(v.id)}
                    />
                  </td>
                  <td className={styles.cellName}>
                    <b>{variantLabel(state.catalog, v)}</b>
                  </td>
                  <td className="num" data-label="Maliyet">
                    {fmtMoney(entry.costMinor)}
                  </td>
                  <td data-label="Kâr modu">{policyText(entry.policy)}</td>
                  <td className="num" data-label="Satış">
                    <b>{fmtMoney(v.saleMinor)}</b>
                  </td>
                  <td className="num" data-label="Bizim kâr">
                    {fmtMoney(ourProfit(v.saleMinor, entry.costMinor))}
                  </td>
                  <td className="num" data-label="PSF">
                    {fmtMoney(psf)}
                    {v.psf.mode === "fixed" && <small className={styles.tag}>sabit</small>}
                  </td>
                  <td className="num" data-label="Eczacı">
                    {fmtRate(markup)}
                  </td>
                  <td data-label="MF">{v.mfRule ? `${v.mfRule.every}+${v.mfRule.free}` : "—"}</td>
                  <td className={styles.cellWarn}>
                    {warnings.includes("sale_not_below_psf") && (
                      <span
                        className={styles.bad}
                        title="Satış fiyatı perakende satış fiyatına eşit ya da yüksek"
                      >
                        <Icon icon={CancelCircleIcon} size={18} />
                      </span>
                    )}
                    {warnings.includes("low_pharmacist_margin") && (
                      <span className={styles.warn} title="Eczacı marjı %10'un altında">
                        <Icon icon={Alert02Icon} size={18} />
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editVariant && (
        <PriceEditor
          key={editVariant.id}
          catalog={state.catalog}
          variant={editVariant}
          entry={costEntryOf(state.costs, editVariant)}
          settings={settings}
          onClose={() => setEditing(null)}
          onSave={(entry, patch) => {
            const priced = applyCostEntry(state, entry, step);
            onChange({
              ...priced,
              catalog: {
                ...priced.catalog,
                variants: priced.catalog.variants.map((x) =>
                  x.id === editVariant.id ? { ...x, ...patch } : x,
                ),
              },
            });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function policyText(policy: ProfitPolicy): string {
  switch (policy.kind) {
    case "markup":
      return `Maliyet +${fmtRate(policy.rate)}`;
    case "margin":
      return `${fmtRate(policy.rate)} marj`;
    case "fixed_price":
      return "Sabit";
    case "target_profit":
      return `Maliyet +${fmtMoney(policy.profitMinor)}`;
  }
}

type VariantPatch = Pick<Variant, "psf" | "pharmacistMarkup" | "vatRate" | "mfRule">;

function PriceEditor({
  catalog,
  variant,
  entry,
  settings,
  onClose,
  onSave,
}: {
  catalog: Catalog;
  variant: Variant;
  entry: CostEntry;
  settings: Settings;
  onClose: () => void;
  onSave: (entry: CostEntry, patch: VariantPatch) => void;
}) {
  const [cost, setCost] = useState(entry.costMinor);
  const [kind, setKind] = useState<ProfitPolicyKind>(entry.policy.kind);
  const [rate, setRate] = useState<number | null>(
    entry.policy.kind === "markup" || entry.policy.kind === "margin" ? entry.policy.rate : 0.5,
  );
  const [amount, setAmount] = useState<number | null>(
    entry.policy.kind === "fixed_price"
      ? entry.policy.priceMinor
      : entry.policy.kind === "target_profit"
        ? entry.policy.profitMinor
        : variant.saleMinor,
  );
  const [psfMode, setPsfMode] = useState<PsfSetting["mode"]>(variant.psf.mode);
  const [psfFixed, setPsfFixed] = useState<number | null>(
    variant.psf.mode === "fixed" ? variant.psf.priceMinor : null,
  );
  const [markup, setMarkup] = useState(variant.pharmacistMarkup);
  const [vat, setVat] = useState(variant.vatRate);
  const [mfEvery, setMfEvery] = useState(variant.mfRule ? String(variant.mfRule.every) : "");
  const [mfFree, setMfFree] = useState(variant.mfRule ? String(variant.mfRule.free) : "");
  const [error, setError] = useState<string | null>(null);
  const feedback = useFeedback();

  const policy: ProfitPolicy | null = (() => {
    if (isRatePolicy(kind)) {
      if (rate === null) return null;
      return kind === "markup" ? { kind: "markup", rate } : { kind: "margin", rate };
    }
    if (amount === null) return null;
    return kind === "fixed_price"
      ? { kind: "fixed_price", priceMinor: amount }
      : { kind: "target_profit", profitMinor: amount };
  })();
  const sale = policy === null ? null : saleFromPolicy(cost, policy, settings.roundingStepMinor);
  const effectiveSale = sale === null ? variant.saleMinor : sale;
  const markupRate = markup === null ? effectiveMarkup(variant, settings) : markup;
  const psf =
    psfMode === "fixed"
      ? psfFixed
      : effectiveSale === null
        ? null
        : psfFromSale(effectiveSale, markupRate, settings.roundingStepMinor);
  const warnings = effectiveSale !== null && psf !== null ? priceWarnings(effectiveSale, psf) : [];

  const save = async () => {
    if (policy === null) return setError("Kâr modu değerini girin.");
    if (kind === "margin" && rate !== null && rate >= 1) {
      return setError("Marj %100 ve üstü olamaz (H5).");
    }
    if (isRatePolicy(kind) && cost === null) {
      return setError("Bu kâr modu için maliyet gerekli. Maliyet yoksa sabit fiyat seçin.");
    }
    if (psfMode === "fixed" && psfFixed === null)
      return setError("Sabit perakende satış fiyatını girin.");
    const every = mfEvery.trim() === "" ? 0 : parseQtyInput(mfEvery);
    const free = mfFree.trim() === "" ? 0 : parseQtyInput(mfFree);
    if (every === null || free === null) return setError("MF kuralı okunamadı.");
    if (every > 0 !== free > 0) return setError("MF için iki kutuyu da doldurun.");
    if (
      warnings.includes("sale_not_below_psf") &&
      !(await feedback.confirm({
        title: "Yine kaydedilsin mi?",
        message:
          "Satış fiyatı perakende satış fiyatına eşit ya da yüksek; eczacı bu üründen kâr etmez.",
        confirmLabel: "Kaydet",
      }))
    ) {
      return undefined;
    }
    const mfRule: MfRule | null = every > 0 ? { every, free } : null;
    const psfSetting: PsfSetting =
      psfMode === "fixed" && psfFixed !== null
        ? { mode: "fixed", priceMinor: psfFixed }
        : { mode: "computed" };
    onSave(
      { variantId: variant.id, costMinor: cost, policy },
      { psf: psfSetting, pharmacistMarkup: markup, vatRate: vat, mfRule },
    );
    return undefined;
  };

  return (
    <Modal title={variantLabel(catalog, variant)} onClose={onClose}>
      <div className={styles.form}>
        <label>
          <span>Maliyet (KDV hariç)</span>
          <MoneyField label="Maliyet" value={cost} onCommit={setCost} placeholder="boş" />
        </label>
        <label>
          <span>Kâr modu</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as ProfitPolicyKind)}>
            {(Object.keys(POLICY_LABELS) as ProfitPolicyKind[]).map((k) => (
              <option key={k} value={k}>
                {POLICY_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>
            {isRatePolicy(kind) ? "Oran" : kind === "fixed_price" ? "Satış fiyatı" : "Kâr tutarı"}
          </span>
          {isRatePolicy(kind) ? (
            <RateField label="Oran" value={rate} onCommit={setRate} />
          ) : (
            <MoneyField label="Tutar" value={amount} onCommit={setAmount} />
          )}
        </label>
        <div className={styles.preview}>
          <span>
            Satış <b className="num">{fmtMoney(effectiveSale)}</b>
          </span>
          <span>
            Bizim kâr <b className="num">{fmtMoney(ourProfit(effectiveSale, cost))}</b>
          </span>
        </div>

        <label>
          <span>Perakende Satış Fiyatı</span>
          <select
            value={psfMode}
            onChange={(e) => setPsfMode(e.target.value as PsfSetting["mode"])}
          >
            <option value="computed">Hesaplanan (satış × eczacı oranı)</option>
            <option value="fixed">Sabit tutar</option>
          </select>
        </label>
        {psfMode === "fixed" ? (
          <label>
            <span>Sabit Perakende Satış Fiyatı</span>
            <MoneyField label="Sabit PSF" value={psfFixed} onCommit={setPsfFixed} />
          </label>
        ) : (
          <label>
            <span>
              {`Ürüne özel eczacı oranı (boş = ${fmtRate(settings.defaultPharmacistMarkup, 0)})`}
            </span>
            <RateField
              label="Eczacı oranı"
              value={markup}
              onCommit={setMarkup}
              placeholder="varsayılan"
            />
          </label>
        )}
        <div className={styles.preview}>
          <span>
            Perakende Satış Fiyatı <b className="num">{fmtMoney(psf)}</b>
          </span>
          <span>
            Eczacı{" "}
            <b className="num">
              {fmtRate(
                effectiveSale !== null && psf !== null ? markupFromPsf(effectiveSale, psf) : null,
              )}
            </b>
          </span>
        </div>
        {warnings.includes("sale_not_below_psf") && (
          <p className={styles.errorText}>
            Satış fiyatı perakende satış fiyatına eşit ya da yüksek.
          </p>
        )}
        {warnings.includes("low_pharmacist_margin") && (
          <p className={styles.warnText}>Eczacı marjı %10'un altında.</p>
        )}

        <label>
          <span>
            {`KDV (boş = ${fmtRate(effectiveVat({ ...variant, vatRate: null }, settings), 0)})`}
          </span>
          <RateField label="KDV" value={vat} onCommit={setVat} placeholder="varsayılan" />
        </label>
        <fieldset className={styles.mf}>
          <legend>MF kuralı (katlanarak)</legend>
          <input
            aria-label="Her kaç kutuya"
            inputMode="numeric"
            placeholder="10"
            value={mfEvery}
            onChange={(e) => setMfEvery(qtyInput(e.target.value))}
          />
          <span>alana</span>
          <input
            aria-label="Kaç kutu MF"
            inputMode="numeric"
            placeholder="1"
            value={mfFree}
            onChange={(e) => setMfFree(qtyInput(e.target.value))}
          />
          <span>bedava</span>
        </fieldset>

        {error !== null && <p className={styles.errorText}>{error}</p>}
        <div className={styles.actions}>
          <button type="button" className="btn" onClick={onClose}>
            Vazgeç
          </button>
          <button type="button" className="btnPrimary" onClick={save}>
            Kaydet
          </button>
        </div>
      </div>
    </Modal>
  );
}
