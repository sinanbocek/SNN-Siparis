import { describe, expect, it } from "vitest";
import type { Catalog, Variant } from "../../domain/catalog/catalog.ts";
import type { CostBook } from "../../domain/costs/costs.ts";
import { DEFAULT_SETTINGS } from "../../domain/settings/settings.ts";
import { priceSettingsOf, previewPriceSettings, samePriceSettings } from "./settingsImpact.ts";

/** Beklenen değerler elle hesaplandı (yorumlarda). Varsayılan: KDV %1, eczacı %20, adım 1 TL. */
const variant = (id: string, patch: Partial<Variant> = {}): Variant => ({
  id,
  familyId: "g",
  name: id,
  unit: "kutu",
  saleMinor: 10000,
  psf: { mode: "computed" },
  pharmacistMarkup: null,
  vatRate: null,
  mfRule: null,
  order: 0,
  active: true,
  ...patch,
});

const CATALOG: Catalog = {
  families: [{ id: "g", name: "Gardegen", color: "#000000", accent: null, order: 0, active: true }],
  variants: [
    // alış 73,40 ₺, %50 kâr → 110,10 ₺ → 1 TL adımda 110 ₺
    variant("a", { saleMinor: 11000 }),
    // sabit fiyat 100 ₺, özel eczacı oranı %30, özel KDV %10
    variant("b", { pharmacistMarkup: 0.3, vatRate: 0.1 }),
    // sabit PSF: eczacı oranından etkilenmez
    variant("c", { psf: { mode: "fixed", priceMinor: 15000 } }),
  ],
};

const COSTS: CostBook = {
  a: { variantId: "a", costMinor: 7340, policy: { kind: "markup", rate: 0.5 } },
  b: { variantId: "b", costMinor: 6000, policy: { kind: "fixed_price", priceMinor: 10000 } },
};

const STATE = { catalog: CATALOG, costs: COSTS };
const BASE = priceSettingsOf(DEFAULT_SETTINGS);

describe("fiyat ayarı etki özeti", () => {
  it("değişiklik yoksa hiçbir ürün değişmez", () => {
    const impact = previewPriceSettings(STATE, DEFAULT_SETTINGS, BASE);
    expect(impact).toMatchObject({ priceChanged: 0, vatAffected: 0, fixedUntouched: 0 });
    expect(impact.example).toBeNull();
    expect(impact.next).toBe(STATE);
  });

  it("eczacı kârı yalnız ayardaki oranı kullanan hesaplı PSF'leri değiştirir", () => {
    // a: 110 ₺ × 1,25 = 137,50 → 138 ₺ (önce 110 × 1,20 = 132 ₺); b özel oran, c sabit PSF
    const impact = previewPriceSettings(STATE, DEFAULT_SETTINGS, {
      ...BASE,
      defaultPharmacistMarkup: 0.25,
    });
    expect(impact.priceChanged).toBe(1);
    expect(impact.example).toEqual({
      label: "Gardegen a",
      field: "psf",
      beforeMinor: 13200,
      afterMinor: 13800,
    });
  });

  it("yuvarlama türetilen satışı yeniden hesaplar, sabit fiyat değişmez", () => {
    // a: kuruş adımında 110,10 ₺ olur (önce 110 ₺).
    const impact = previewPriceSettings(STATE, DEFAULT_SETTINGS, { ...BASE, roundingStepMinor: 1 });
    expect(impact.example).toEqual({
      label: "Gardegen a",
      field: "sale",
      beforeMinor: 11000,
      afterMinor: 11010,
    });
    // b sabit satış, PSF 100 × 1,3 = 130 (her iki adımda aynı). c'nin alış kaydı yok:
    // satışı elle girilmiş sayılır, o da sabit → sabit fiyatlı 2 ürün.
    expect(impact.priceChanged).toBe(1);
    expect(impact.fixedUntouched).toBe(2);
    expect(impact.next.catalog.variants[0]?.saleMinor).toBe(11010);
  });

  it("KDV yalnız ürüne özel KDV'si olmayanları etkiler; net fiyat değişmez", () => {
    const impact = previewPriceSettings(STATE, DEFAULT_SETTINGS, { ...BASE, vatRate: 0.1 });
    expect(impact).toMatchObject({ priceChanged: 0, vatAffected: 2 });
  });

  it("taslak karşılaştırma", () => {
    expect(samePriceSettings(BASE, { ...BASE })).toBe(true);
    expect(samePriceSettings(BASE, { ...BASE, vatRate: 0.2 })).toBe(false);
  });
});
