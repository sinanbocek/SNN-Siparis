import {
  Alert02Icon,
  Calculator01Icon,
  CancelCircleIcon,
  MoreVerticalIcon,
  Search01Icon,
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
  variantLabel,
  variantPsf,
  type MfRule,
  type Variant,
} from "../../domain/catalog/catalog.ts";
import { ourProfit, type CostEntry } from "../../domain/costs/costs.ts";
import { parseQtyInput, qtyInput } from "../../domain/input/parse.ts";
import { priceWarnings } from "../../domain/pricing/pricing.ts";
import type { Settings } from "../../domain/settings/settings.ts";
import { fmtMoney, fmtRate } from "../parts/format.ts";
import { useFeedback } from "../parts/feedback.tsx";
import { Icon, MoneyField, RateField } from "../parts/parts.tsx";
import styles from "./admin.module.css";
import shared from "./settings.module.css";

interface Props {
  state: PricingState;
  settings: Settings;
  onChange: (state: PricingState) => string | null;
  onEditProduct: (variantId: string) => void;
}

export function PricingTab({ state, settings, onChange, onEditProduct }: Props) {
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [query, setQuery] = useState("");
  const [openFamilies, setOpenFamilies] = useState<ReadonlySet<string>>(() => {
    const first = [...state.catalog.families].sort((a, b) => a.order - b.order)[0];
    return new Set(first ? [first.id] : []);
  });
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [undoRows, setUndoRows] = useState<Readonly<Record<string, RowSnapshot>>>({});
  const stateRef = useRef(state);
  stateRef.current = state;
  const families = useMemo(
    () => [...state.catalog.families].sort((a, b) => a.order - b.order),
    [state.catalog.families],
  );
  const groups = useMemo(
    () =>
      families.map((family) => ({
        family,
        variants: [...state.catalog.variants]
          .filter((variant) => variant.familyId === family.id)
          .sort((a, b) => a.order - b.order),
      })),
    [families, state.catalog.variants],
  );
  const rows = groups.flatMap((group) => group.variants);
  const step = settings.roundingStepMinor;
  const allIds = rows.map((r) => r.id);
  const target = selected.length > 0 ? selected : allIds;
  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const saveRow = (variantId: string, entry: CostEntry, patch: Partial<Variant>): string | null => {
    const current = stateRef.current;
    const variant = current.catalog.variants.find((item) => item.id === variantId);
    if (!variant) return "Ürün bulunamadı; kayıt yapılamadı.";
    setUndoRows((previous) =>
      previous[variantId]
        ? previous
        : { ...previous, [variantId]: { entry: costEntryOf(current.costs, variant), variant } },
    );
    const priced = applyCostEntry(current, entry, step);
    const next: PricingState = {
      ...priced,
      catalog: {
        ...priced.catalog,
        variants: priced.catalog.variants.map((item) =>
          item.id === variantId ? { ...item, ...patch } : item,
        ),
      },
    };
    stateRef.current = next;
    return onChange(next);
  };
  const undoRow = (variantId: string): string | null => {
    const snapshot = undoRows[variantId];
    if (!snapshot) return "Geri alınacak değişiklik bulunamadı.";
    const current = stateRef.current;
    const restored = applyCostEntry(current, snapshot.entry, step);
    const next: PricingState = {
      ...restored,
      catalog: {
        ...restored.catalog,
        variants: restored.catalog.variants.map((item) =>
          item.id === variantId ? snapshot.variant : item,
        ),
      },
    };
    stateRef.current = next;
    const error = onChange(next);
    if (error === null) {
      setUndoRows((previous) =>
        Object.fromEntries(Object.entries(previous).filter(([id]) => id !== variantId)),
      );
    }
    return error;
  };
  const applyOtherChange = (next: PricingState) => {
    setUndoRows({});
    stateRef.current = next;
    onChange(next);
  };
  const needle = query.trim().toLocaleLowerCase("tr-TR");

  return (
    <div className={`${styles.tab} ${styles.pricingPage}`}>
      <header className={styles.pricingHead}>
        <div>
          <h2>Fiyatlama</h2>
          <p>Üç fiyatı girin; iki tarafın kutu başı kazancı otomatik hesaplansın.</p>
        </div>
        <label className={styles.pricingSearch}>
          <Icon icon={Search01Icon} size={18} />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              const nextQuery = event.target.value;
              setQuery(nextQuery);
              const nextNeedle = nextQuery.trim().toLocaleLowerCase("tr-TR");
              if (nextNeedle !== "") {
                setOpenFamilies(
                  new Set(
                    groups
                      .filter(({ family, variants }) =>
                        variants.some((variant) =>
                          `${family.name} ${variant.name} ${variant.unit}`
                            .toLocaleLowerCase("tr-TR")
                            .includes(nextNeedle),
                        ),
                      )
                      .map(({ family }) => family.id),
                  ),
                );
              }
            }}
            placeholder="Ürün ara"
            aria-label="Fiyatlamada ürün ara"
          />
        </label>
      </header>

      {groups.map(({ family, variants }) => {
        const matches = variants.filter((variant) =>
          `${family.name} ${variant.name} ${variant.unit}`
            .toLocaleLowerCase("tr-TR")
            .includes(needle),
        );
        if (matches.length === 0) return null;
        const isOpen = openFamilies.has(family.id);
        const incomplete = variants.filter(
          (variant) =>
            costEntryOf(state.costs, variant).costMinor === null ||
            variant.saleMinor === null ||
            variantPsf(variant, settings) === null,
        ).length;
        return (
          <section className={styles.priceGroup} key={family.id}>
            <button
              type="button"
              className={styles.priceGroupHead}
              aria-expanded={isOpen}
              onClick={() =>
                setOpenFamilies((previous) => {
                  const next = new Set(previous);
                  if (next.has(family.id)) next.delete(family.id);
                  else next.add(family.id);
                  return next;
                })
              }
            >
              <span
                className={isOpen ? styles.groupChevronOpen : styles.groupChevron}
                aria-hidden="true"
              >
                ›
              </span>
              <b>{family.name}</b>
              <span className={styles.groupMeta}>{variants.length} ürün</span>
              {incomplete > 0 && (
                <span className={styles.groupMissing}>{incomplete} fiyat eksik</span>
              )}
            </button>
            {isOpen && (
              <>
                <div className={styles.pricingColumns} aria-hidden="true">
                  <span>Ürün</span>
                  <div className={styles.pricingColumnFields}>
                    <span>Benim alışım</span>
                    <span>Eczaneye satışım</span>
                    <span>Perakende satışı</span>
                  </div>
                  <span />
                </div>
                <div className={styles.priceRows}>
                  {matches.map((variant) => (
                    <PriceRow
                      key={variant.id}
                      variant={variant}
                      familyLabel={family.name}
                      state={state}
                      settings={settings}
                      selected={selected.includes(variant.id)}
                      undo={undoRows[variant.id] !== undefined}
                      detailsOpen={detailsId === variant.id}
                      onToggleSelect={() => toggle(variant.id)}
                      onEditProduct={() => onEditProduct(variant.id)}
                      onToggleDetails={() =>
                        setDetailsId((id) => (id === variant.id ? null : variant.id))
                      }
                      onUndo={() => undoRow(variant.id)}
                      onCommit={(entry, patch) => saveRow(variant.id, entry, patch)}
                    />
                  ))}
                </div>
              </>
            )}
          </section>
        );
      })}

      {groups.every(({ family, variants }) =>
        variants.every(
          (variant) =>
            !`${family.name} ${variant.name} ${variant.unit}`
              .toLocaleLowerCase("tr-TR")
              .includes(needle),
        ),
      ) && <p className={styles.pricingEmpty}>Aramanızla eşleşen ürün bulunamadı.</p>}

      <details className={styles.pricingTools}>
        <summary>Toplu işlemler ve alış tahmini</summary>
        {selected.length > 0 && (
          <p className={styles.pricingToolHint}>
            {selected.length} ürün seçildi. Seçim yoksa tüm ürünler hedeflenir.
          </p>
        )}
        <BulkCard
          state={state}
          targetIds={target}
          selectedCount={selected.length}
          totalCount={allIds.length}
          step={step}
          onChange={applyOtherChange}
          onClearSelection={() => setSelected([])}
        />
        <EstimateRow state={state} onChange={applyOtherChange} />
      </details>
    </div>
  );
}

interface RowSnapshot {
  entry: CostEntry;
  variant: Variant;
}

function PriceRow({
  variant,
  familyLabel,
  state,
  settings,
  selected,
  undo,
  detailsOpen,
  onToggleSelect,
  onEditProduct,
  onToggleDetails,
  onUndo,
  onCommit,
}: {
  variant: Variant;
  familyLabel: string;
  state: PricingState;
  settings: Settings;
  selected: boolean;
  undo: boolean;
  detailsOpen: boolean;
  onToggleSelect: () => void;
  onEditProduct: () => void;
  onToggleDetails: () => void;
  onUndo: () => string | null;
  onCommit: (entry: CostEntry, patch: Partial<Variant>) => string | null;
}) {
  const [rowStatus, setRowStatus] = useState<string | null>(null);
  const entry = costEntryOf(state.costs, variant);
  const psf = variantPsf(variant, settings);
  const ownProfitMinor = ourProfit(variant.saleMinor, entry.costMinor);
  const pharmacyProfitMinor =
    variant.saleMinor === null || psf === null ? null : math.sub(psf, variant.saleMinor);
  const ownMargin =
    ownProfitMinor === null || variant.saleMinor === null || variant.saleMinor <= 0
      ? null
      : math.div(ownProfitMinor, variant.saleMinor);
  const pharmacyMargin =
    pharmacyProfitMinor === null || psf === null || psf <= 0
      ? null
      : math.div(pharmacyProfitMinor, psf);
  const warnings =
    variant.saleMinor !== null && psf !== null ? priceWarnings(variant.saleMinor, psf) : [];
  const saleEntry = (saleMinor: number | null): CostEntry => ({
    ...entry,
    policy: saleMinor === null ? entry.policy : { kind: "fixed_price", priceMinor: saleMinor },
  });
  const saveCost = (costMinor: number | null) => {
    if (costMinor === entry.costMinor) return;
    const policy =
      variant.saleMinor === null
        ? entry.policy
        : { kind: "fixed_price" as const, priceMinor: variant.saleMinor };
    setRowStatus(onCommit({ ...entry, costMinor, policy }, {}) ?? "Kaydedildi");
  };
  const saveSale = (saleMinor: number | null) => {
    if (saleMinor === variant.saleMinor) return;
    setRowStatus(
      onCommit(saleEntry(saleMinor), {
        saleMinor,
        ...(psf === null ? {} : { psf: { mode: "fixed" as const, priceMinor: psf } }),
      }) ?? "Kaydedildi",
    );
  };
  const saveRetail = (priceMinor: number | null) => {
    const next =
      priceMinor === null ? { mode: "computed" as const } : { mode: "fixed" as const, priceMinor };
    const unchanged =
      variant.psf.mode === "computed"
        ? next.mode === "computed"
        : next.mode === "fixed" && variant.psf.priceMinor === next.priceMinor;
    if (unchanged) return;
    setRowStatus(onCommit(entry, { psf: next }) ?? "Kaydedildi");
  };
  const commitDetails = (nextEntry: CostEntry, patch: Partial<Variant>) => {
    const error = onCommit(nextEntry, patch);
    setRowStatus(error ?? "Kaydedildi");
    return error;
  };

  return (
    <article className={`${styles.priceRow} ${variant.active ? "" : styles.priceRowInactive}`}>
      <div className={styles.priceMainRow}>
        <label className={styles.bulkSelect} title="Toplu işlem için seç">
          <input
            type="checkbox"
            aria-label={`${familyLabel} ${variant.name} toplu işlem için seç`}
            checked={selected}
            onChange={onToggleSelect}
          />
        </label>
        <div className={styles.priceProduct}>
          <button type="button" className={styles.priceProductName} onClick={onEditProduct}>
            {variantLabel(state.catalog, variant)}
          </button>
          {!variant.active && <small>Satış kataloğunda gizli</small>}
          {warnings.includes("sale_not_below_psf") && (
            <small className={styles.priceWarning}>
              <Icon icon={CancelCircleIcon} size={14} /> Eczane kazancı yok
            </small>
          )}
          {warnings.includes("low_pharmacist_margin") && (
            <small className={styles.priceWarning}>
              <Icon icon={Alert02Icon} size={14} /> Eczane kazancı düşük
            </small>
          )}
        </div>
        <div className={styles.priceFields}>
          <label className={styles.priceField}>
            <MoneyField
              label={`${variantLabel(state.catalog, variant)} benim alışım`}
              value={entry.costMinor}
              onCommit={saveCost}
            />
          </label>
          <label className={styles.priceField}>
            <MoneyField
              label={`${variantLabel(state.catalog, variant)} eczaneye satışım`}
              value={variant.saleMinor}
              onCommit={saveSale}
            />
          </label>
          <label className={styles.priceField}>
            <MoneyField
              label={`${variantLabel(state.catalog, variant)} perakende satışı`}
              value={psf}
              onCommit={saveRetail}
            />
          </label>
        </div>
        <div className={styles.priceGains} aria-live="polite">
          <span>
            Benim kazancım <b className="num">{fmtMoney(ownProfitMinor)}</b>{" "}
            <span>({fmtRate(ownMargin)})</span>
          </span>
          <span>
            Eczanenin kazancı <b className="num">{fmtMoney(pharmacyProfitMinor)}</b>{" "}
            <span>({fmtRate(pharmacyMargin)})</span>
          </span>
          {rowStatus && (
            <span
              className={
                rowStatus === "Kaydedildi" || rowStatus === "Geri alındı"
                  ? styles.rowStatus
                  : styles.rowStatusError
              }
              role="status"
            >
              {rowStatus}
            </span>
          )}
          {undo && (
            <button
              type="button"
              className={styles.rowUndo}
              onClick={() => setRowStatus(onUndo() ?? "Geri alındı")}
            >
              Geri al
            </button>
          )}
        </div>
        <button
          type="button"
          className={`${styles.priceDetailsButton} ${detailsOpen ? styles.priceDetailsButtonOn : ""}`}
          aria-expanded={detailsOpen}
          aria-label={`${variantLabel(state.catalog, variant)} ayrıntıları`}
          onClick={onToggleDetails}
        >
          <Icon icon={MoreVerticalIcon} size={18} />
        </button>
      </div>
      {detailsOpen && (
        <ProductDetails
          key={variant.id}
          variant={variant}
          settings={settings}
          entry={entry}
          onCommit={commitDetails}
        />
      )}
    </article>
  );
}

function ProductDetails({
  variant,
  settings,
  entry,
  onCommit,
}: {
  variant: Variant;
  settings: Settings;
  entry: CostEntry;
  onCommit: (entry: CostEntry, patch: Partial<Variant>) => string | null;
}) {
  const [every, setEvery] = useState(variant.mfRule ? String(variant.mfRule.every) : "");
  const [free, setFree] = useState(variant.mfRule ? String(variant.mfRule.free) : "");
  const [mfHint, setMfHint] = useState("");
  const defaultVat = effectiveVat({ ...variant, vatRate: null }, settings);
  const commitMf = () => {
    const parsedEvery = every.trim() === "" ? 0 : parseQtyInput(every);
    const parsedFree = free.trim() === "" ? 0 : parseQtyInput(free);
    if (parsedEvery === null || parsedFree === null) {
      setMfHint("Adetleri kontrol edin.");
      return;
    }
    if (parsedEvery > 0 !== parsedFree > 0) {
      setMfHint("Mal fazlası için iki alanı da doldurun.");
      return;
    }
    const mfRule: MfRule | null = parsedEvery > 0 ? { every: parsedEvery, free: parsedFree } : null;
    setMfHint("");
    if (JSON.stringify(mfRule) !== JSON.stringify(variant.mfRule)) onCommit(entry, { mfRule });
  };
  return (
    <div className={styles.priceDetails}>
      <label className={styles.detailVat}>
        <span>Ürüne özel KDV</span>
        <RateField
          label={`${variant.name} ürüne özel KDV`}
          value={variant.vatRate}
          placeholder={`${fmtRate(defaultVat, 0).replace("%", "")} · varsayılan`}
          onCommit={(vatRate) => {
            if (vatRate !== variant.vatRate) onCommit(entry, { vatRate });
          }}
        />
        <small>
          {variant.vatRate === null
            ? "Genel KDV varsayılanı kullanılıyor. Fiyatlar KDV hariçtir."
            : "Bu ürün için özel oran kullanılıyor. Fiyatlar KDV hariçtir."}
        </small>
      </label>
      <div className={styles.detailMf}>
        <span>Mal fazlası</span>
        <div>
          <span>Her</span>
          <input
            aria-label={`${variant.name} her kaç kutuya`}
            inputMode="numeric"
            value={every}
            onChange={(event) => setEvery(qtyInput(event.target.value))}
            onBlur={commitMf}
          />
          <span>kutuya</span>
          <input
            aria-label={`${variant.name} kaç kutu bedava`}
            inputMode="numeric"
            value={free}
            onChange={(event) => setFree(qtyInput(event.target.value))}
            onBlur={commitMf}
          />
          <span>kutu bedava</span>
        </div>
        {mfHint && <small role="status">{mfHint}</small>}
      </div>
    </div>
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
