import { math } from "@snn/abacus-core";
import type { Catalog, Family, Variant } from "../../domain/catalog/catalog.ts";
import { roundToStep } from "../../domain/pricing/pricing.ts";
import { DEFAULT_SETTINGS } from "../../domain/settings/settings.ts";

/**
 * Başlangıç verisi (PRD Ek A). Kaynak PSF tablosudur: satış = PSF ÷ 1,20, 1 TL'ye yuvarlanır.
 * MALİYET BURADA YOKTUR (ADR-0002); maliyetler yalnız cihazda, yönetim ekranından girilir.
 */

const COPPER = "#C0703F";

export const SEED_FAMILIES: readonly Family[] = [
  { id: "gardegen", name: "Gardegen", color: "#1E7B45", accent: null, order: 1, active: true },
  { id: "magmeda", name: "Magmeda-6", color: "#3A6EA5", accent: null, order: 2, active: true },
  { id: "silimagen", name: "Silimagen", color: "#C9A227", accent: null, order: 3, active: true },
  { id: "stomagen", name: "Stomagen", color: "#7B4FA0", accent: null, order: 4, active: true },
  {
    id: "tinagen",
    name: "Tinagen Complex",
    color: "#1F4E8C",
    accent: COPPER,
    order: 5,
    active: true,
  },
  { id: "vivagen", name: "Vivagen", color: "#2E8B3E", accent: COPPER, order: 6, active: true },
  {
    id: "d-panthenol",
    name: "D-Panthenol",
    color: "#8A8F98",
    accent: null,
    order: 7,
    active: true,
  },
  {
    id: "kantaron",
    name: "Ozonlanmış Kantaron",
    color: "#8A8F98",
    accent: null,
    order: 8,
    active: true,
  },
];

/** [varyant kimliği, aile, ad, PSF (TL)] */
const PSF_TABLE: readonly (readonly [string, string, string, number])[] = [
  ["gardegen-120", "gardegen", "120 Kapsül", 3840],
  ["gardegen-60", "gardegen", "60 Kapsül", 2400],
  ["gardegen-krem", "gardegen", "Krem %15 Sinekatesin 40 ml", 1340],
  ["magmeda-60", "magmeda", "60 Kapsül", 550],
  ["magmeda-90", "magmeda", "90 Kapsül", 750],
  ["silimagen-60", "silimagen", "60 Kapsül", 990],
  ["silimagen-90", "silimagen", "90 Kapsül", 1250],
  ["stomagen-gargara", "stomagen", "Gargara 200 ml", 440],
  ["stomagen-sprey", "stomagen", "Sprey 50 ml", 490],
  ["tinagen-30", "tinagen", "30 Kapsül", 650],
  ["vivagen-60", "vivagen", "60 Kapsül", 850],
  ["vivagen-sampuan", "vivagen", "Şampuan 350 ml", 450],
  ["d-panthenol-sprey", "d-panthenol", "%9 Sprey 150 ml", 320],
  ["kantaron-50", "kantaron", "Zeytinyağı 50 ml", 550],
];

/** PSF'den eczane alış fiyatı: PSF ÷ (1 + %20), yuvarlama adımına. */
export function seedSaleMinor(psfLira: number): number {
  const psfMinor = math.mul(psfLira, 100);
  const sale = math.div(psfMinor, math.add(1, DEFAULT_SETTINGS.defaultPharmacistMarkup));
  const rounded = sale === null ? null : roundToStep(sale, DEFAULT_SETTINGS.roundingStepMinor);
  if (rounded === null) throw new Error(`Başlangıç fiyatı hesaplanamadı: ${psfLira}`);
  return rounded;
}

export const SEED_PSF_MINOR: Readonly<Record<string, number>> = Object.fromEntries(
  PSF_TABLE.map(([id, , , psf]) => [id, math.mul(psf, 100)]),
);

export const SEED_VARIANTS: readonly Variant[] = PSF_TABLE.map(([id, familyId, name, psf], i) => ({
  id,
  familyId,
  name,
  unit: "kutu",
  saleMinor: seedSaleMinor(psf),
  psf: { mode: "computed" },
  pharmacistMarkup: null,
  vatRate: null,
  mfRule: null,
  order: i + 1,
  active: true,
}));

export const SEED_CATALOG: Catalog = { families: SEED_FAMILIES, variants: SEED_VARIANTS };

/**
 * Kutu görselleri (public/products, 600 px WebP). Aile görseli, görseli olmayan
 * varyantlarda da kullanılır (karar 15a). Kullanıcının yüklediği görsel bunları ezer.
 */
export const SEED_IMAGES: Readonly<Record<string, string>> = {
  "family:gardegen": "/products/gardegen.webp",
  "family:magmeda": "/products/magmeda.webp",
  "family:silimagen": "/products/silimagen.webp",
  "family:stomagen": "/products/stomagen-sprey.webp",
  "variant:stomagen-gargara": "/products/stomagen-gargara.webp",
  "family:tinagen": "/products/tinagen.webp",
  "family:vivagen": "/products/vivagen.webp",
};
