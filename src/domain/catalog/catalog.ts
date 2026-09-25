import type { MinorAmount, Rate } from "../abacus/index.ts";
import { psfFromSale } from "../pricing/pricing.ts";
import type { Settings } from "../settings/settings.ts";

/** Ürün ailesi (Gardegen, Stomagen…). Maliyet burada yoktur (ADR-0002). */
export interface Family {
  readonly id: string;
  readonly name: string;
  /** Aksan rengi (#rrggbb). */
  readonly color: string;
  /** İkinci aksan (Tinagen/Vivagen bakır şerit); yoksa null. */
  readonly accent: string | null;
  readonly order: number;
  readonly active: boolean;
}

export type PsfSetting =
  { readonly mode: "computed" } | { readonly mode: "fixed"; readonly priceMinor: MinorAmount };

/** MF kuralı: her `every` kutuya `free` kutu, katlanarak (S1). */
export interface MfRule {
  readonly every: number;
  readonly free: number;
}

export interface Variant {
  readonly id: string;
  readonly familyId: string;
  readonly name: string;
  readonly unit: string;
  /** Eczaneye satış (KDV hariç). null = fiyat girilmedi; sepete eklenemez. */
  readonly saleMinor: MinorAmount | null;
  readonly psf: PsfSetting;
  /** Ürüne özel eczacı oranı; null = ayarlardaki varsayılan. */
  readonly pharmacistMarkup: Rate | null;
  /** Ürüne özel KDV; null = ayarlardaki oran. */
  readonly vatRate: Rate | null;
  readonly mfRule: MfRule | null;
  readonly order: number;
  readonly active: boolean;
}

export interface Catalog {
  readonly families: readonly Family[];
  readonly variants: readonly Variant[];
}

export function familyOf(catalog: Catalog, variant: Variant): Family | undefined {
  return catalog.families.find((f) => f.id === variant.familyId);
}

export function variantLabel(catalog: Catalog, variant: Variant): string {
  const family = familyOf(catalog, variant);
  return family ? `${family.name} ${variant.name}` : variant.name;
}

export function effectiveMarkup(variant: Variant, settings: Settings): Rate {
  return variant.pharmacistMarkup ?? settings.defaultPharmacistMarkup;
}

export function effectiveVat(variant: Variant, settings: Settings): Rate {
  return variant.vatRate ?? settings.vatRate;
}

/** Katalogdaki PSF (sepet oranı değişikliği yokken). */
export function variantPsf(variant: Variant, settings: Settings): MinorAmount | null {
  if (variant.psf.mode === "fixed") return variant.psf.priceMinor;
  if (variant.saleMinor === null) return null;
  return psfFromSale(
    variant.saleMinor,
    effectiveMarkup(variant, settings),
    settings.roundingStepMinor,
  );
}

/** Satış ekranında görünen, sıralı ve yayındaki aileler/varyantlar. */
export function visibleFamilies(catalog: Catalog): Family[] {
  return [...catalog.families].filter((f) => f.active).sort((a, b) => a.order - b.order);
}

export function visibleVariants(catalog: Catalog, familyId: string): Variant[] {
  return catalog.variants
    .filter((v) => v.familyId === familyId && v.active)
    .sort((a, b) => a.order - b.order);
}

export function findVariant(catalog: Catalog, id: string): Variant | undefined {
  return catalog.variants.find((v) => v.id === id);
}
