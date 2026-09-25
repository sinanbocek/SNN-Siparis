import { math, type MinorAmount, type Rate } from "../abacus/index.ts";
import { roundToStep } from "../pricing/pricing.ts";

/**
 * Maliyet ve bizim kâr — YALNIZ yönetim tarafı (ADR-0002).
 * Bu klasörü satış ekranları import edemez; eslint boundaries zorlar.
 * Kâr modu adları ihale projesindeki `ProfitPolicy` ile aynı (+ `margin`).
 */
export type ProfitPolicy =
  | { readonly kind: "markup"; readonly rate: Rate }
  | { readonly kind: "margin"; readonly rate: Rate }
  | { readonly kind: "fixed_price"; readonly priceMinor: MinorAmount }
  | { readonly kind: "target_profit"; readonly profitMinor: MinorAmount };

export type ProfitPolicyKind = ProfitPolicy["kind"];

export interface CostEntry {
  readonly variantId: string;
  /** null = maliyet girilmedi; bizim kâr "—" gösterilir, 0 sayılmaz (H2). */
  readonly costMinor: MinorAmount | null;
  readonly policy: ProfitPolicy;
}

export type CostBook = Readonly<Record<string, CostEntry>>;

/** Maliyet ve kâr modundan satış fiyatını türetir. Sabit fiyat yuvarlanmaz (H10). */
export function saleFromPolicy(
  costMinor: MinorAmount | null,
  policy: ProfitPolicy,
  stepMinor: MinorAmount,
): MinorAmount | null {
  if (policy.kind === "fixed_price") {
    return Number.isSafeInteger(policy.priceMinor) && policy.priceMinor > 0
      ? policy.priceMinor
      : null;
  }
  if (costMinor === null || !Number.isSafeInteger(costMinor) || costMinor <= 0) return null;
  switch (policy.kind) {
    case "markup":
      if (!Number.isFinite(policy.rate) || policy.rate < 0) return null;
      return roundToStep(math.mul(costMinor, math.add(1, policy.rate)), stepMinor);
    case "margin": {
      // m < 1 zorunlu (H5): %100 marj sonsuz fiyattır.
      if (!Number.isFinite(policy.rate) || policy.rate < 0 || policy.rate >= 1) return null;
      const sale = math.div(costMinor, math.sub(1, policy.rate));
      return sale === null ? null : roundToStep(sale, stepMinor);
    }
    case "target_profit":
      if (!Number.isSafeInteger(policy.profitMinor)) return null;
      return roundToStep(math.add(costMinor, policy.profitMinor), stepMinor);
  }
}

/** Bizim kâr = satış − maliyet; maliyet yoksa null. */
export function ourProfit(saleMinor: MinorAmount | null, costMinor: MinorAmount | null) {
  if (saleMinor === null || costMinor === null) return null;
  return math.sub(saleMinor, costMinor);
}

/** "%40 marjdan tahmin et": maliyet = satış × 0,60 (kuruşa yuvarlanır). */
export const ESTIMATE_MARGIN: Rate = 0.4;

export function estimateCostFromSale(saleMinor: MinorAmount): MinorAmount {
  return math.round(math.mul(saleMinor, math.sub(1, ESTIMATE_MARGIN)), 0);
}

/** Politikanın ekrandaki sayısal değeri (oran % olarak, tutar kuruş). */
export function policyValue(policy: ProfitPolicy): number {
  switch (policy.kind) {
    case "markup":
    case "margin":
      return policy.rate;
    case "fixed_price":
      return policy.priceMinor;
    case "target_profit":
      return policy.profitMinor;
  }
}

export function isRatePolicy(kind: ProfitPolicyKind): boolean {
  return kind === "markup" || kind === "margin";
}

export const DEFAULT_POLICY: ProfitPolicy = { kind: "markup", rate: 0.5 };
