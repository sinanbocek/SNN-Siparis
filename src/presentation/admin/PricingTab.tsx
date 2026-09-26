import {
  Alert02Icon,
  ArrowRight01Icon,
  Calculator01Icon,
  CancelCircleIcon,
} from "@hugeicons/core-free-icons";
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
  ourProfit,
  saleFromPolicy,
  type CostEntry,
  type ProfitPolicy,
} from "../../domain/costs/costs.ts";
import { parseQtyInput, qtyInput } from "../../domain/input/parse.ts";
import { markupFromPsf, priceWarnings, psfFromSale } from "../../domain/pricing/pricing.ts";
import type { Settings } from "../../domain/settings/settings.ts";
import { fmtMoney, fmtRate } from "../parts/format.ts";
import { useFeedback } from "../parts/feedback.tsx";
import { Icon, Modal, MoneyField, RateField } from "../parts/parts.tsx";
import styles from "./admin.module.css";
import ed from "./priceEditor.module.css";
import shared from "./settings.module.css";

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

type SaleSource = "manual" | "cost";
type CostMethod = "markup" | "margin" | "target_profit";
type PsfMode = PsfSetting["mode"];

const COST_METHODS: readonly (readonly [CostMethod, string])[] = [
  ["markup", "% ekle"],
  ["margin", "% marj"],
  ["target_profit", "TL ekle"],
];

const METHOD_FIELD: Record<CostMethod, string> = {
  markup: "Alışıma eklenecek oran",
  margin: "Marj (satış içindeki payım)",
  target_profit: "Alışıma eklenecek tutar",
};

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
}) {
  return (
    <div className={shared.segmented} role="radiogroup" aria-label={label}>
      {options.map(([id, text]) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          onClick={() => onChange(id)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** Tutar ve oran: "₺1.280,00 · %40". Oran hesaplanamazsa yalnız tutar. */
function amountWithRate(amount: number | null, base: number | null): string {
  if (amount === null) return fmtMoney(null);
  const rate = base === null || base <= 0 ? null : math.div(amount, base);
  return rate === null ? fmtMoney(amount) : `${fmtMoney(amount)} · ${fmtRate(rate, 0)}`;
}

/**
 * Ürün fiyat penceresi (proje sahibi 26.09.2026, taslak onaylı): üstte hep görünen fiyat
 * zinciri; Eczaneye Satışım ve Perakende Satış Fiyatı için iki basit soru; MF tek cümle;
 * KDV kapalı; Vazgeç / Kaydet altta sabit.
 */
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
  const initial = entry.policy;
  const [cost, setCost] = useState(entry.costMinor);
  const [source, setSource] = useState<SaleSource>(
    initial.kind === "fixed_price" ? "manual" : "cost",
  );
  const [method, setMethod] = useState<CostMethod>(
    initial.kind === "fixed_price" ? "margin" : initial.kind,
  );
  const [rate, setRate] = useState<number | null>(
    initial.kind === "markup" || initial.kind === "margin" ? initial.rate : null,
  );
  const [profit, setProfit] = useState<number | null>(
    initial.kind === "target_profit" ? initial.profitMinor : null,
  );
  const [manualSale, setManualSale] = useState<number | null>(
    initial.kind === "fixed_price" ? initial.priceMinor : variant.saleMinor,
  );
  const [psfMode, setPsfMode] = useState<PsfMode>(variant.psf.mode);
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
    if (source === "manual") {
      return manualSale === null ? null : { kind: "fixed_price", priceMinor: manualSale };
    }
    if (method === "target_profit") {
      return profit === null ? null : { kind: "target_profit", profitMinor: profit };
    }
    if (rate === null) return null;
    return method === "markup" ? { kind: "markup", rate } : { kind: "margin", rate };
  })();
  const step = settings.roundingStepMinor;
  const sale = policy === null ? null : saleFromPolicy(cost, policy, step);
  const defaultMarkup = settings.defaultPharmacistMarkup;
  const psf =
    psfMode === "fixed"
      ? psfFixed
      : sale === null
        ? null
        : psfFromSale(sale, markup ?? defaultMarkup, step);
  const warnings = sale !== null && psf !== null ? priceWarnings(sale, psf) : [];
  const ourAmount = ourProfit(sale, cost);
  const pharmacistAmount = sale === null || psf === null ? null : math.sub(psf, sale);
  const defaultVat = effectiveVat({ ...variant, vatRate: null }, settings);

  const save = async () => {
    if (source === "cost" && cost === null) {
      return setError("Alışımdan hesaplamak için Benim Alışım fiyatını yazın.");
    }
    if (policy === null) {
      return setError(
        source === "manual" ? "Eczaneye Satışım fiyatını yazın." : "Hesap için değeri yazın.",
      );
    }
    if (policy.kind === "margin" && policy.rate >= 1) {
      return setError("Marj %100 ve üstü olamaz.");
    }
    if (psfMode === "fixed" && psfFixed === null) {
      return setError("Perakende Satış Fiyatını yazın.");
    }
    const every = mfEvery.trim() === "" ? 0 : parseQtyInput(mfEvery);
    const free = mfFree.trim() === "" ? 0 : parseQtyInput(mfFree);
    if (every === null || free === null) return setError("MF okunamadı.");
    if (every > 0 !== free > 0) return setError("MF için iki kutuyu da doldurun.");
    if (
      warnings.includes("sale_not_below_psf") &&
      !(await feedback.confirm({
        title: "Yine kaydedilsin mi?",
        message:
          "Eczaneye Satışım, Perakende Satış Fiyatına eşit ya da yüksek; eczacı bu üründen kâr etmez.",
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
      {
        psf: psfSetting,
        pharmacistMarkup: psfMode === "fixed" ? variant.pharmacistMarkup : markup,
        vatRate: vat,
        mfRule,
      },
    );
    return undefined;
  };

  const edit =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setError(null);
    };

  return (
    <Modal
      title={variantLabel(catalog, variant)}
      onClose={onClose}
      footer={
        <>
          {error !== null && (
            <p className={ed.error} role="alert">
              {error}
            </p>
          )}
          <div className={ed.footButtons}>
            <button type="button" className="btn" onClick={onClose}>
              Vazgeç
            </button>
            <button type="button" className="btnPrimary" onClick={() => void save()}>
              Kaydet
            </button>
          </div>
        </>
      }
    >
      <div className={ed.chain} aria-live="polite" aria-label="Fiyat özeti">
        <div className={ed.steps}>
          <span>
            <small>Benim Alışım</small>
            <b className="num">{fmtMoney(cost)}</b>
          </span>
          <Icon icon={ArrowRight01Icon} size={16} />
          <span>
            <small>Eczaneye Satışım</small>
            <b className="num">{fmtMoney(sale)}</b>
          </span>
          <Icon icon={ArrowRight01Icon} size={16} />
          <span>
            <small>Perakende Satış</small>
            <b className="num">{fmtMoney(psf)}</b>
          </span>
        </div>
        <div className={ed.gains}>
          <span>
            Bizim kâr <b className="num">{amountWithRate(ourAmount, sale)}</b>
          </span>
          <span>
            Eczacı kârı <b className="num">{amountWithRate(pharmacistAmount, sale)}</b>
          </span>
        </div>
        {warnings.includes("sale_not_below_psf") && (
          <p className={ed.bad}>Eczaneye Satışım, Perakende Satış Fiyatından düşük değil.</p>
        )}
        {warnings.includes("low_pharmacist_margin") && (
          <p className={ed.warn}>Eczacı kârı %10&apos;un altında.</p>
        )}
      </div>

      <section className={ed.section} aria-labelledby="editor-sale">
        <h3 id="editor-sale">Eczaneye Satışım</h3>
        <Choice
          label="Eczaneye Satışım nasıl belirlensin"
          value={source}
          options={[
            ["manual", "Elle yazarım"],
            ["cost", "Alışımdan hesapla"],
          ]}
          onChange={edit(setSource)}
        />
        <label className={ed.field}>
          <span>
            Benim Alışım (KDV hariç)
            {source === "manual" && <small> · raporlarda kâr için</small>}
          </span>
          <MoneyField label="Benim Alışım" value={cost} onCommit={edit(setCost)} />
        </label>
        {source === "manual" ? (
          <label className={ed.field}>
            <span>Eczaneye Satışım (KDV hariç)</span>
            <MoneyField
              label="Eczaneye Satışım"
              value={manualSale}
              onCommit={edit(setManualSale)}
            />
          </label>
        ) : (
          <>
            <Choice
              label="Hesap yöntemi"
              value={method}
              options={COST_METHODS}
              onChange={edit(setMethod)}
            />
            <label className={ed.field}>
              <span>{METHOD_FIELD[method]}</span>
              {method === "target_profit" ? (
                <MoneyField
                  key="profit"
                  label={METHOD_FIELD[method]}
                  value={profit}
                  onCommit={edit(setProfit)}
                />
              ) : (
                <RateField
                  key={method}
                  label={METHOD_FIELD[method]}
                  value={rate}
                  onCommit={edit(setRate)}
                />
              )}
            </label>
          </>
        )}
      </section>

      <section className={ed.section} aria-labelledby="editor-psf">
        <h3 id="editor-psf">Perakende Satış Fiyatı</h3>
        <Choice
          label="Perakende Satış Fiyatı nasıl belirlensin"
          value={psfMode}
          options={[
            ["computed", "Eczacı oranından"],
            ["fixed", "Elle yazarım"],
          ]}
          onChange={edit(setPsfMode)}
        />
        {psfMode === "fixed" ? (
          <label className={ed.field}>
            <span>Perakende Satış Fiyatı</span>
            <MoneyField
              label="Perakende Satış Fiyatı"
              value={psfFixed}
              onCommit={edit(setPsfFixed)}
            />
          </label>
        ) : (
          <label className={ed.field}>
            <span>Eczacı oranı</span>
            <RateField
              label="Eczacı oranı"
              value={markup}
              onCommit={edit(setMarkup)}
              placeholder={`${fmtRate(defaultMarkup, 0).replace("%", "")} (varsayılan)`}
            />
          </label>
        )}
      </section>

      <section className={ed.section} aria-labelledby="editor-mf">
        <h3 id="editor-mf">Mal fazlası (MF)</h3>
        <div className={ed.mf}>
          <span>Her</span>
          <input
            aria-label="Her kaç kutuya"
            inputMode="numeric"
            value={mfEvery}
            onChange={(e) => edit(setMfEvery)(qtyInput(e.target.value))}
          />
          <span>kutuya</span>
          <input
            aria-label="Kaç kutu bedava"
            inputMode="numeric"
            value={mfFree}
            onChange={(e) => edit(setMfFree)(qtyInput(e.target.value))}
          />
          <span>kutu bedava</span>
          <small>(katlanarak; boşsa MF yok)</small>
        </div>
        <details className={ed.more} open={vat !== null}>
          <summary>
            Ürüne özel KDV (şu an {fmtRate(vat ?? defaultVat, 0)}
            {vat === null ? ", varsayılan" : ""})
          </summary>
          <label className={ed.field}>
            <span>KDV oranı</span>
            <RateField
              label="Ürüne özel KDV"
              value={vat}
              onCommit={edit(setVat)}
              placeholder={`${fmtRate(defaultVat, 0).replace("%", "")} (varsayılan)`}
            />
          </label>
        </details>
      </section>
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
        <div className={`${shared.segmented} ${styles.dirSeg}`} role="radiogroup" aria-label="Yön">
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
        <div
          className={`${shared.segmented} ${styles.unitSeg}`}
          role="radiogroup"
          aria-label="Birim"
        >
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
          <button type="button" className={`btn ${styles.previewBtn}`} onClick={showPreview}>
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
