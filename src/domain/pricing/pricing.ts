import { math, type MinorAmount, type Rate } from "../abacus/index.ts";

/**
 * Fiyat zinciri (PRD §7):
 * maliyet ──(bizim kâr)──▶ satış = eczane alışı ──(eczacı kârı)──▶ PSF
 * Hesaplanamayan değer `null` döner; asla 0 uydurulmaz.
 */

/** Tutarı yuvarlama adımına half-up yuvarlar (adım kuruş; 100 = 1 TL). */
export function roundToStep(value: number, stepMinor: MinorAmount): MinorAmount | null {
  if (!Number.isFinite(value) || !Number.isSafeInteger(stepMinor) || stepMinor <= 0) return null;
  const units = math.div(value, stepMinor);
  if (units === null) return null;
  return math.mul(math.round(units, 0), stepMinor);
}

/** PSF = satış × (1 + eczacı oranı), adıma yuvarlanır. */
export function psfFromSale(
  saleMinor: MinorAmount,
  pharmacistMarkup: Rate,
  stepMinor: MinorAmount,
): MinorAmount | null {
  if (!Number.isFinite(pharmacistMarkup) || pharmacistMarkup < 0) return null;
  return roundToStep(math.mul(saleMinor, math.add(1, pharmacistMarkup)), stepMinor);
}

/** Sabit PSF'den eczacı oranını geri hesaplar: PSF ÷ satış − 1. */
export function markupFromPsf(saleMinor: MinorAmount, psfMinor: MinorAmount): Rate | null {
  const ratio = math.div(psfMinor, saleMinor);
  if (ratio === null || saleMinor <= 0) return null;
  return math.sub(ratio, 1);
}

/** Tüketici raf fiyatı (KDV dahil) — yalnız bilgi amaçlı. */
export function withVat(netMinor: MinorAmount, vatRate: Rate): MinorAmount {
  return math.add(netMinor, vatOnMinor(netMinor, vatRate));
}

/** KDV toplam üzerinden bir kez, kuruşa half-up (ihale ADR-0015 ile aynı kural). */
export function vatOnMinor(netMinor: MinorAmount, vatRate: Rate): MinorAmount {
  return math.round(math.mul(netMinor, vatRate), 0);
}

export type PriceWarning = "low_pharmacist_margin" | "sale_not_below_psf";

/** Eczacı marjı %10'un altında sarı uyarı, satış ≥ PSF kırmızı hata (H3, H4). */
export const LOW_PHARMACIST_MARGIN: Rate = 0.1;

export function priceWarnings(saleMinor: MinorAmount, psfMinor: MinorAmount): PriceWarning[] {
  const warnings: PriceWarning[] = [];
  if (saleMinor >= psfMinor) {
    warnings.push("sale_not_below_psf");
    return warnings;
  }
  const markup = markupFromPsf(saleMinor, psfMinor);
  if (markup !== null && markup < LOW_PHARMACIST_MARGIN) warnings.push("low_pharmacist_margin");
  return warnings;
}
