import { describe, expect, it } from "vitest";
import type { Catalog, Variant } from "../../domain/catalog/catalog.ts";
import type { CostBook } from "../../domain/costs/costs.ts";
import { missingCostIds, previewBulk } from "./pricing.ts";

/** Beklenen değerler elle hesaplandı (yorumlarda). Adım 1 TL = 100 kuruş. */
const variant = (id: string, saleMinor: number | null): Variant => ({
  id,
  familyId: "g",
  name: id,
  unit: "kutu",
  saleMinor,
  psf: { mode: "computed" },
  pharmacistMarkup: null,
  vatRate: null,
  mfRule: null,
  order: 0,
  active: true,
});

const CATALOG: Catalog = {
  families: [{ id: "g", name: "Gardegen", color: "#000000", accent: null, order: 0, active: true }],
  variants: [variant("a", 200000), variant("b", 300), variant("c", null)],
};

const COSTS: CostBook = {
  a: { variantId: "a", costMinor: 120000, policy: { kind: "fixed_price", priceMinor: 200000 } },
};

const STATE = { catalog: CATALOG, costs: COSTS };
const ALL = ["a", "b", "c"];

describe("toplu fiyat önizlemesi", () => {
  it("%10 indirim: 2.000 ₺ → 1.800 ₺; 3 ₺ → 2,70 → 3 ₺ (değişmez); fiyatsız ürün sayılmaz", () => {
    const preview = previewBulk(STATE, ALL, { kind: "percent", rate: -0.1 }, 100);
    expect(preview).toMatchObject({ changed: 1, skipped: 0 });
    expect(preview.example).toEqual({
      label: "Gardegen a",
      beforeMinor: 200000,
      afterMinor: 180000,
    });
    expect(preview.next.catalog.variants[0]?.saleMinor).toBe(180000);
  });

  it("5 ₺ indirim: 3 ₺'lik ürün sıfırın altına düşer, atlanır ve fiyatı değişmez", () => {
    const preview = previewBulk(STATE, ALL, { kind: "amount", amountMinor: -500 }, 100);
    expect(preview).toMatchObject({ changed: 1, skipped: 1 });
    expect(preview.next.catalog.variants[1]?.saleMinor).toBe(300);
  });

  it("yalnız seçili ürünler", () => {
    const preview = previewBulk(STATE, ["b"], { kind: "percent", rate: 1 }, 100);
    expect(preview.changed).toBe(1);
    expect(preview.next.catalog.variants[0]?.saleMinor).toBe(200000);
    expect(preview.next.catalog.variants[1]?.saleMinor).toBe(600);
  });

  it("alışı boş ürünler: fiyatı olup alışı girilmemiş olanlar", () => {
    expect(missingCostIds(STATE)).toEqual(["b"]);
  });
});
