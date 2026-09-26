import type { MinorAmount } from "../../domain/abacus/index.ts";
import { variantLabel, variantPsf } from "../../domain/catalog/catalog.ts";
import type { Settings } from "../../domain/settings/settings.ts";
import { costEntryOf, rederiveSales, type PricingState } from "./pricing.ts";

/** Fiyatı etkileyen ayarlar: bunlar taslakta bekler, "Kaydet" ile uygulanır (karar 2a). */
export type PriceSettings = Pick<
  Settings,
  "vatRate" | "defaultPharmacistMarkup" | "roundingStepMinor"
>;

export interface ImpactExample {
  readonly label: string;
  /** "sale" = Eczaneye Satışım, "psf" = Perakende Satış Fiyatı. */
  readonly field: "sale" | "psf";
  readonly beforeMinor: MinorAmount | null;
  readonly afterMinor: MinorAmount | null;
}

export interface PriceSettingsImpact {
  /** Eczaneye Satışım ya da Perakende Satış Fiyatı değişen ürün sayısı. */
  readonly priceChanged: number;
  /** Ayarlardaki KDV'yi kullanan ürün sayısı (KDV değiştiyse; yoksa 0). */
  readonly vatAffected: number;
  /** Yuvarlama değiştiyse sabit fiyatlı olduğu için değişmeyen ürün sayısı; yoksa 0. */
  readonly fixedUntouched: number;
  readonly example: ImpactExample | null;
  /** Kaydedilince yazılacak fiyat durumu. */
  readonly next: PricingState;
}

export function priceSettingsOf(settings: Settings): PriceSettings {
  return {
    vatRate: settings.vatRate,
    defaultPharmacistMarkup: settings.defaultPharmacistMarkup,
    roundingStepMinor: settings.roundingStepMinor,
  };
}

export function samePriceSettings(a: PriceSettings, b: PriceSettings): boolean {
  return (
    a.vatRate === b.vatRate &&
    a.defaultPharmacistMarkup === b.defaultPharmacistMarkup &&
    a.roundingStepMinor === b.roundingStepMinor
  );
}

/**
 * Fiyat ayarı taslağının etkisi: hangi ürünün fiyatı değişir, örnek önce → sonra.
 * Hesap `rederiveSales` ve `variantPsf` ile aynı yoldan gider; özet ile kayıt ayrışamaz.
 */
export function previewPriceSettings(
  state: PricingState,
  before: Settings,
  draft: PriceSettings,
): PriceSettingsImpact {
  const after: Settings = { ...before, ...draft };
  const stepChanged = after.roundingStepMinor !== before.roundingStepMinor;
  const vatChanged = after.vatRate !== before.vatRate;
  const next = stepChanged ? rederiveSales(state, after.roundingStepMinor) : state;

  let priceChanged = 0;
  let vatAffected = 0;
  let fixedUntouched = 0;
  let example: ImpactExample | null = null;

  state.catalog.variants.forEach((variant, index) => {
    const updated = next.catalog.variants[index] ?? variant;
    const saleBefore = variant.saleMinor;
    const saleAfter = updated.saleMinor;
    const psfBefore = variantPsf(variant, before);
    const psfAfter = variantPsf(updated, after);
    const saleMoved = saleBefore !== saleAfter;
    const psfMoved = psfBefore !== psfAfter;
    if (saleMoved || psfMoved) {
      priceChanged += 1;
      if (example === null) {
        example = saleMoved
          ? {
              label: variantLabel(state.catalog, variant),
              field: "sale",
              beforeMinor: saleBefore,
              afterMinor: saleAfter,
            }
          : {
              label: variantLabel(state.catalog, variant),
              field: "psf",
              beforeMinor: psfBefore,
              afterMinor: psfAfter,
            };
      }
    }
    if (vatChanged && variant.vatRate === null) vatAffected += 1;
    if (
      stepChanged &&
      variant.saleMinor !== null &&
      costEntryOf(state.costs, variant).policy.kind === "fixed_price"
    ) {
      fixedUntouched += 1;
    }
  });

  return { priceChanged, vatAffected, fixedUntouched, example, next };
}
