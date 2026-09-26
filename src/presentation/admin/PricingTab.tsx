import { Alert02Icon, Calculator01Icon, CancelCircleIcon } from "@hugeicons/core-free-icons";
import { useMemo, useRef, useState } from "react";
import {
  applyCostEntry,
  costEntryOf,
  estimateMissingCosts,
  missingCostIds,
  previewBulk,
  type BulkChange,
  type BulkPreview,
  type PricingState,
} from "../../application/admin/pricing.ts";
import { math } from "../../domain/abacus/index.ts";
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
import shared from "./settings.module.css";

const POLICY_LABELS: Record<ProfitPolicyKind, string> = {
  markup: "Alışıma % ekle",
  margin: "Satıştan % marj",
  fixed_price: "Sabit eczaneye satış",
  target_profit: "Alışıma TL ekle",
};

interface Props {
  state: PricingState;
  settings: Settings;
  onChange: (state: PricingState) => void;
}

export function PricingTab({ state, settings, onChange }: Props) {
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
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
      <BulkCard
        state={state}
        targetIds={target}
        selectedCount={selected.length}
        totalCount={allIds.length}
        step={step}
        onChange={onChange}
        onClearSelection={() => setSelected([])}
      />
      <EstimateRow state={state} onChange={onChange} />

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
              <th className="num">Alışım</th>
              <th>Kâr modu</th>
              <th className="num">Eczaneye satışım</th>
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
                  <td className="num" data-label="Alışım">
                    {fmtMoney(entry.costMinor)}
                  </td>
                  <td data-label="Kâr modu">{policyText(entry.policy)}</td>
                  <td className="num" data-label="Eczaneye satışım">
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
                        title="Eczaneye satışım perakende satış fiyatına eşit ya da yüksek"
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
      return `Alış +${fmtRate(policy.rate)}`;
    case "margin":
      return `${fmtRate(policy.rate)} marj`;
    case "fixed_price":
      return "Sabit";
    case "target_profit":
      return `Alış +${fmtMoney(policy.profitMinor)}`;
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
      return setError("Bu kâr modu için alış fiyatınız gerekli. Yoksa sabit eczaneye satış seçin.");
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
          "Eczaneye satışım perakende satış fiyatına eşit ya da yüksek; eczacı bu üründen kâr etmez.",
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
          <span>Benim Alışım (KDV hariç)</span>
          <MoneyField label="Benim alışım" value={cost} onCommit={setCost} placeholder="boş" />
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
            {isRatePolicy(kind)
              ? "Oran"
              : kind === "fixed_price"
                ? "Eczaneye Satışım"
                : "Kâr tutarı"}
          </span>
          {isRatePolicy(kind) ? (
            <RateField label="Oran" value={rate} onCommit={setRate} />
          ) : (
            <MoneyField label="Tutar" value={amount} onCommit={setAmount} />
          )}
        </label>
        <div className={styles.preview}>
          <span>
            Eczaneye Satışım <b className="num">{fmtMoney(effectiveSale)}</b>
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
            Eczaneye satışım perakende satış fiyatına eşit ya da yüksek.
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

/**
 * Geri al 10 sn sonra çağrılır: o anki yazıcıyı kullanmalı. Eski yazıcı eski durumla
 * karşılaştırıp "değişiklik yok" sanır ve hiçbir şey yazmaz.
 */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

type Direction = "up" | "down";
type Unit = "percent" | "amount";

/** Kutudaki pozitif değer + yön → işaretli değişiklik (indirimde eksi). */
function toChange(direction: Direction, unit: Unit, value: number): BulkChange {
  const signed = direction === "down" ? math.sub(0, value) : value;
  return unit === "percent"
    ? { kind: "percent", rate: signed }
    : { kind: "amount", amountMinor: signed };
}

function changeText(direction: Direction, unit: Unit, value: number): string {
  const whole = Number.isInteger(math.mul(value, 100));
  const size = unit === "percent" ? fmtRate(value, whole ? 0 : 1) : fmtMoney(value);
  return `${size} ${direction === "up" ? "artacak" : "düşecek"}`;
}

/**
 * Toplu fiyat değişikliği (proje sahibi 26.09.2026): yön, birim, tek tutar; önce önizleme,
 * sonra Uygula. Seçim yoksa onay sorulur; ardından 10 sn Geri al.
 */
function BulkCard({
  state,
  targetIds,
  selectedCount,
  totalCount,
  step,
  onChange,
  onClearSelection,
}: {
  state: PricingState;
  targetIds: readonly string[];
  selectedCount: number;
  totalCount: number;
  step: number;
  onChange: (state: PricingState) => void;
  onClearSelection: () => void;
}) {
  const feedback = useFeedback();
  const latestChange = useLatest(onChange);
  const [direction, setDirection] = useState<Direction>("up");
  const [unit, setUnit] = useState<Unit>("percent");
  const [value, setValue] = useState<number | null>(null);
  const [fieldKey, setFieldKey] = useState(0);
  const [preview, setPreview] = useState<BulkPreview | null>(null);

  const edit = (change: () => void) => {
    change();
    setPreview(null);
  };
  const reset = () => {
    setValue(null);
    setPreview(null);
    setFieldKey((k) => k + 1);
  };

  const showPreview = () => {
    if (value === null || value <= 0) {
      feedback.toast({ text: "Önce bir tutar yazın.", tone: "info" });
      return;
    }
    setPreview(previewBulk(state, targetIds, toChange(direction, unit, value), step));
  };

  const apply = async () => {
    if (preview === null || value === null) return;
    if (selectedCount === 0) {
      const ok = await feedback.confirm({
        title: "Tüm ürünlerin fiyatı değişecek",
        message: `${preview.changed} ürünün Eczaneye Satışım fiyatı ${changeText(direction, unit, value)}.`,
        confirmLabel: "Uygula",
      });
      if (!ok) return;
    }
    const before = state;
    onChange(preview.next);
    feedback.toast({
      text: `${preview.changed} ürünün fiyatı güncellendi.`,
      tone: "success",
      action: {
        label: "Geri al",
        onClick: () => {
          latestChange.current(before);
          feedback.toast({ text: "Toplu değişiklik geri alındı.", tone: "info" });
        },
      },
    });
    reset();
  };

  return (
    <section className={styles.bulkCard} aria-labelledby="bulk-title">
      <h3 id="bulk-title">Toplu fiyat değişikliği</h3>
      <p className={styles.note}>
        Seçili ürünlerin Eczaneye Satışım fiyatını değiştirir. Seçim yoksa tüm ürünlere uygulanır.
      </p>
      <div className={styles.bulkControls}>
        <div className={shared.segmented} role="radiogroup" aria-label="Yön">
          {DIRECTIONS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={direction === id}
              onClick={() => edit(() => setDirection(id))}
            >
              {label}
            </button>
          ))}
        </div>
        <div className={styles.bulkValue}>
          {unit === "percent" ? (
            <RateField
              key={`p-${fieldKey}`}
              label="Toplu değişiklik yüzdesi"
              value={value}
              placeholder="5"
              onCommit={(v) => edit(() => setValue(v))}
            />
          ) : (
            <MoneyField
              key={`a-${fieldKey}`}
              label="Toplu değişiklik tutarı"
              value={value}
              placeholder="10"
              onCommit={(v) => edit(() => setValue(v))}
            />
          )}
        </div>
        <div className={shared.segmented} role="radiogroup" aria-label="Birim">
          {UNITS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={unit === id}
              onClick={() => {
                if (unit === id) return;
                setUnit(id);
                reset();
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {preview === null && (
          <button type="button" className="btn" onClick={showPreview}>
            Önizle
          </button>
        )}
      </div>
      <p className={styles.note}>
        Kapsam:{" "}
        <b className={styles.scope}>
          {selectedCount > 0 ? `${selectedCount} seçili ürün` : `Tüm ürünler (${totalCount})`}
        </b>
        {selectedCount > 0 && (
          <>
            {" "}
            <button type="button" className={styles.link} onClick={onClearSelection}>
              Seçimi kaldır
            </button>
          </>
        )}
        {` · sonuç yuvarlama adımına (${fmtMoney(step)}) yuvarlanır ve sabit fiyat olur.`}
      </p>
      {preview !== null && value !== null && (
        <div className={shared.impact}>
          <div className={shared.impactText} aria-live="polite">
            <strong>
              {preview.changed > 0
                ? `${preview.changed} ürünün fiyatı ${changeText(direction, unit, value)}.`
                : "Hiçbir ürünün fiyatı değişmeyecek."}
            </strong>
            {preview.example !== null && (
              <span>
                Örnek: {preview.example.label}{" "}
                <span className="num">{fmtMoney(preview.example.beforeMinor)}</span> →{" "}
                <b className="num">{fmtMoney(preview.example.afterMinor)}</b>
              </span>
            )}
            {preview.skipped > 0 && (
              <span>{preview.skipped} ürün sıfırın altına düşeceği için değişmeyecek.</span>
            )}
          </div>
          <div className={shared.actions}>
            <button type="button" className="btn" onClick={() => setPreview(null)}>
              Vazgeç
            </button>
            <button
              type="button"
              className="btnPrimary"
              disabled={preview.changed === 0}
              onClick={() => void apply()}
            >
              Uygula
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

const DIRECTIONS: readonly (readonly [Direction, string])[] = [
  ["up", "Artır"],
  ["down", "Azalt"],
];

const UNITS: readonly (readonly [Unit, string])[] = [
  ["percent", "%"],
  ["amount", "TL"],
];

/** Alışı boş ürünler için tahmin; yalnız böyle ürün varsa görünür. */
function EstimateRow({
  state,
  onChange,
}: {
  state: PricingState;
  onChange: (state: PricingState) => void;
}) {
  const feedback = useFeedback();
  const latestChange = useLatest(onChange);
  const missing = missingCostIds(state);
  if (missing.length === 0) return null;
  const estimate = () => {
    const before = state;
    onChange(estimateMissingCosts(state, missing));
    feedback.toast({
      text: `${missing.length} ürüne tahmini alış yazıldı.`,
      tone: "success",
      action: { label: "Geri al", onClick: () => latestChange.current(before) },
    });
  };
  return (
    <section className={styles.estimateRow} aria-labelledby="estimate-title">
      <div>
        <h3 id="estimate-title">{missing.length} ürünün Benim Alışım fiyatı boş</h3>
        <p className={styles.note}>
          Raporlarda bu ürünlerin kârı hesaplanamaz. Tahmin: Eczaneye Satışım fiyatının %60&apos;ı.
        </p>
      </div>
      <button type="button" className="btn" onClick={estimate}>
        <Icon icon={Calculator01Icon} size={18} /> Alışları tahmin et
      </button>
    </section>
  );
}
