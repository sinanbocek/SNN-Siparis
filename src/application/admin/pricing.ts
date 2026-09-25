import { math, type MinorAmount } from "../../domain/abacus/index.ts";
import type { Catalog, Variant } from "../../domain/catalog/catalog.ts";
import {
  DEFAULT_POLICY,
  ESTIMATE_MARGIN,
  estimateCostFromSale,
  saleFromPolicy,
  type CostBook,
  type CostEntry,
} from "../../domain/costs/costs.ts";
import { roundToStep } from "../../domain/pricing/pricing.ts";

/** Yönetim ekranının fiyat işlemleri. Maliyet `CostBook`'ta, satış kataloğa yazılır (ADR-0002). */
export interface PricingState {
  readonly catalog: Catalog;
  readonly costs: CostBook;
}

export function costEntryOf(costs: CostBook, variant: Variant): CostEntry {
  return (
    costs[variant.id] ?? {
      variantId: variant.id,
      costMinor: null,
      policy:
        variant.saleMinor === null
          ? DEFAULT_POLICY
          : { kind: "fixed_price", priceMinor: variant.saleMinor },
    }
  );
}

function withSale(catalog: Catalog, variantId: string, saleMinor: MinorAmount | null): Catalog {
  return {
    ...catalog,
    variants: catalog.variants.map((v) => (v.id === variantId ? { ...v, saleMinor } : v)),
  };
}

/**
 * Maliyet/kâr modunu kaydeder ve satışı yeniden türetir.
 * Satış türetilemezse (maliyet yok, geçersiz oran) katalogdaki satış değişmez.
 */
export function applyCostEntry(
  state: PricingState,
  entry: CostEntry,
  stepMinor: MinorAmount,
): PricingState {
  const costs = { ...state.costs, [entry.variantId]: entry };
  const sale = saleFromPolicy(entry.costMinor, entry.policy, stepMinor);
  if (sale === null) return { catalog: state.catalog, costs };
  return { catalog: withSale(state.catalog, entry.variantId, sale), costs };
}

export type BulkChange =
  | { readonly kind: "percent"; readonly rate: number }
  | { readonly kind: "amount"; readonly amountMinor: MinorAmount };

/** Seçili ürünlere toplu fiyat değişikliği; sonuç adıma yuvarlanır ve sabit fiyat olur. */
export function bulkAdjust(
  state: PricingState,
  variantIds: readonly string[],
  change: BulkChange,
  stepMinor: MinorAmount,
): PricingState {
  let next = state;
  for (const variant of state.catalog.variants) {
    if (!variantIds.includes(variant.id) || variant.saleMinor === null) continue;
    const raw =
      change.kind === "percent"
        ? math.mul(variant.saleMinor, math.add(1, change.rate))
        : math.add(variant.saleMinor, change.amountMinor);
    const sale = roundToStep(raw, stepMinor);
    if (sale === null || sale <= 0) continue;
    const entry = costEntryOf(next.costs, variant);
    next = applyCostEntry(
      next,
      { ...entry, policy: { kind: "fixed_price", priceMinor: sale } },
      stepMinor,
    );
  }
  return next;
}

/** "%40 marjdan tahmin et": maliyeti boş olanlara maliyet = satış × 0,60, mod = %40 marj. */
export function estimateMissingCosts(
  state: PricingState,
  variantIds: readonly string[],
): PricingState {
  const costs: Record<string, CostEntry> = { ...state.costs };
  for (const variant of state.catalog.variants) {
    if (!variantIds.includes(variant.id) || variant.saleMinor === null) continue;
    if (costEntryOf(costs, variant).costMinor !== null) continue;
    costs[variant.id] = {
      variantId: variant.id,
      costMinor: estimateCostFromSale(variant.saleMinor),
      policy: { kind: "margin", rate: ESTIMATE_MARGIN },
    };
  }
  return { catalog: state.catalog, costs };
}

/** Yuvarlama adımı değişince türetilen fiyatlar yeniden hesaplanır; sabitler dokunulmaz (H10). */
export function rederiveSales(state: PricingState, stepMinor: MinorAmount): PricingState {
  let catalog = state.catalog;
  for (const entry of Object.values(state.costs)) {
    if (entry.policy.kind === "fixed_price") continue;
    const sale = saleFromPolicy(entry.costMinor, entry.policy, stepMinor);
    if (sale !== null) catalog = withSale(catalog, entry.variantId, sale);
  }
  return { catalog, costs: state.costs };
}
