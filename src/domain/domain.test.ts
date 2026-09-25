import { describe, expect, it } from "vitest";
import { SEED_CATALOG, SEED_PSF_MINOR, SEED_VARIANTS } from "../composition/seed/seed.ts";
import { findVariant, variantPsf, type Catalog } from "./catalog/catalog.ts";
import {
  EMPTY_CART,
  mfFromRule,
  setCartMarkup,
  setLinePsf,
  setQty,
  summarizeCart,
  updateLine,
} from "./cart/cart.ts";
import {
  estimateCostFromSale,
  ourProfit,
  saleFromPolicy,
  type ProfitPolicy,
} from "./costs/costs.ts";
import {
  MONEY_INPUT_MESSAGES,
  moneyInputStep,
  parseMoneyInput,
  parseQtyInput,
  parseRateInput,
  phoneDisplay,
  phoneInput,
  qtyInput,
  rateToInput,
} from "./input/parse.ts";
import { buildOrder, nextOrderNo, orderFileName, type Order } from "./order/order.ts";
import { priceWarnings, psfFromSale, roundToStep } from "./pricing/pricing.ts";
import { DEFAULT_SETTINGS } from "./settings/settings.ts";

/**
 * Beklenen değerler master plandaki PSF tablosundan ve elle hesaptan alınır (Ek A),
 * kodun kendi çıktısından değil.
 */
const settings = DEFAULT_SETTINGS;

function variant(id: string) {
  const found = findVariant(SEED_CATALOG, id);
  if (!found) throw new Error(id);
  return found;
}

describe("başlangıç verisi — satış = PSF ÷ 1,20, 1 TL'ye", () => {
  it.each([
    ["gardegen-120", 320000],
    ["gardegen-60", 200000],
    ["gardegen-krem", 111700],
    ["magmeda-60", 45800],
    ["magmeda-90", 62500],
    ["silimagen-60", 82500],
    ["silimagen-90", 104200],
    ["stomagen-gargara", 36700],
    ["stomagen-sprey", 40800],
    ["tinagen-30", 54200],
    ["vivagen-60", 70800],
    ["vivagen-sampuan", 37500],
    ["d-panthenol-sprey", 26700],
    ["kantaron-50", 45800],
  ])("%s satış %i kuruş", (id, sale) => {
    expect(variant(id).saleMinor).toBe(sale);
  });

  it("hesaplanan PSF tablodaki PSF'ye birebir döner (14 ürün)", () => {
    expect(SEED_VARIANTS).toHaveLength(14);
    for (const v of SEED_VARIANTS) expect(variantPsf(v, settings)).toBe(SEED_PSF_MINOR[v.id]);
  });
});

describe("fiyatlama", () => {
  it.each([
    [111666.67, 100, 111700],
    [111649, 100, 111600],
    [111650, 100, 111700],
    [111666.67, 1, 111667],
    [123456, 1000, 123000],
  ])("roundToStep(%d, %i) = %i", (value, step, expected) => {
    expect(roundToStep(value, step)).toBe(expected);
  });

  it("geçersiz adım null döner", () => {
    expect(roundToStep(100, 0)).toBeNull();
  });

  it("PSF = satış × 1,20 → 1 TL", () => {
    expect(psfFromSale(200000, 0.2, 100)).toBe(240000);
    expect(psfFromSale(111700, 0.2, 100)).toBe(134000);
  });

  it("uyarılar: satış ≥ PSF hata, marj < %10 uyarı (H3, H4)", () => {
    expect(priceWarnings(100000, 100000)).toEqual(["sale_not_below_psf"]);
    expect(priceWarnings(100000, 105000)).toEqual(["low_pharmacist_margin"]);
    expect(priceWarnings(100000, 120000)).toEqual([]);
  });
});

describe("maliyet ve kâr modu (yalnız yönetim)", () => {
  it.each<[number | null, ProfitPolicy, number | null]>([
    [100000, { kind: "markup", rate: 0.5 }, 150000],
    [120000, { kind: "margin", rate: 0.4 }, 200000],
    [120000, { kind: "margin", rate: 1 }, null],
    [120000, { kind: "margin", rate: 1.2 }, null],
    [100000, { kind: "target_profit", profitMinor: 25000 }, 125000],
    [null, { kind: "fixed_price", priceMinor: 99999 }, 99999],
    [null, { kind: "markup", rate: 0.5 }, null],
    [33333, { kind: "markup", rate: 0.5 }, 50000],
  ])("maliyet %s, %o → %s", (cost, policy, expected) => {
    expect(saleFromPolicy(cost, policy, 100)).toBe(expected);
  });

  it("maliyet boşsa bizim kâr null, 0 değil (H2)", () => {
    expect(ourProfit(200000, null)).toBeNull();
    expect(ourProfit(200000, 120000)).toBe(80000);
  });

  it("%40 marjdan tahmin: maliyet = satış × 0,60", () => {
    expect(estimateCostFromSale(200000)).toBe(120000);
    expect(estimateCostFromSale(111700)).toBe(67020);
  });
});

describe("MF — katlanarak (S1)", () => {
  it.each([
    [25, { every: 10, free: 1 }, 2],
    [9, { every: 10, free: 3 }, 0],
    [20, { every: 10, free: 3 }, 6],
    [10, null, 0],
  ])("%i kutu, %o → %i MF", (qty, rule, mf) => {
    expect(mfFromRule(qty, rule)).toBe(mf);
  });
});

describe("sepet hesabı", () => {
  const base = setQty(setQty(EMPTY_CART, variant("gardegen-60"), 10), variant("silimagen-60"), 12);

  it("toplamlar, KDV %1 ve eczacı kazancı (elle hesap)", () => {
    const s = summarizeCart(SEED_CATALOG, settings, base);
    // 10 × 2.000 + 12 × 825 = 29.900 TL
    expect(s.netMinor).toBe(2990000);
    expect(s.vatGroups).toEqual([{ rate: 0.01, baseMinor: 2990000, vatMinor: 29900 }]);
    expect(s.grossMinor).toBe(3019900);
    // 10 × 2.400 + 12 × 990 = 35.880 → kazanç 5.980 (%20)
    expect(s.shelfRevenueMinor).toBe(3588000);
    expect(s.pharmacistProfitMinor).toBe(598000);
    expect(s.pharmacistRate).toBe(0.2);
    // Raf fiyatı KDV dahil: 35.880 × 1,01 = 36.238,80
    expect(s.shelfGrossMinor).toBe(3623880);
  });

  it("Σ satır = toplam, kuruşu kuruşuna (H8)", () => {
    const s = summarizeCart(SEED_CATALOG, settings, base);
    expect(s.lines.reduce((a, l) => a + l.amountMinor, 0)).toBe(s.netMinor);
  });

  it("MF kural + elle değişiklik; kazanca eklenmez, raf değeri bilgi olarak (M2, S2, S4)", () => {
    const catalog: Catalog = {
      ...SEED_CATALOG,
      variants: SEED_CATALOG.variants.map((v) =>
        v.id === "gardegen-60" ? { ...v, mfRule: { every: 10, free: 1 } } : v,
      ),
    };
    const s = summarizeCart(catalog, settings, base);
    expect(s.mfTotal).toBe(1);
    expect(s.pharmacistProfitMinor).toBe(598000);
    expect(s.mfShelfValueMinor).toBe(240000);
    const manual = summarizeCart(
      catalog,
      settings,
      updateLine(base, "gardegen-60", { mfOverride: 3 }),
    );
    expect(manual.mfTotal).toBe(3);
    expect(manual.lines[0]?.mfFromRule).toBe(1);
  });

  it("sepette eczacı oranı yalnız bu sipariş (H9)", () => {
    const s = summarizeCart(SEED_CATALOG, settings, { ...base, markupOverride: 0.25 });
    // 2.000 × 1,25 = 2.500; 825 × 1,25 = 1.031,25 → 1.031
    expect(s.shelfRevenueMinor).toBe(10 * 250000 + 12 * 103100);
    expect(settings.defaultPharmacistMarkup).toBe(0.2);
  });

  it("iki yönlü: satıra PSF yazılınca oran geri hesaplanır; sepet oranı elle fiyatları sıfırlar", () => {
    const withPsf = setLinePsf(base, "gardegen-60", 250000);
    const s = summarizeCart(SEED_CATALOG, settings, withPsf);
    expect(s.lines[0]).toMatchObject({ psfMinor: 250000, lineMarkup: 0.25, psfOverridden: true });
    // 10 × 2.500 + 12 × 990 = 36.880 → kazanç 6.980
    expect(s.pharmacistProfitMinor).toBe(698000);
    const back = summarizeCart(SEED_CATALOG, settings, setCartMarkup(withPsf, 0.3));
    expect(back.lines[0]).toMatchObject({ psfMinor: 260000, psfOverridden: false });
    expect(
      summarizeCart(SEED_CATALOG, settings, setLinePsf(withPsf, "gardegen-60", null)).lines[0]
        ?.psfMinor,
    ).toBe(240000);
  });

  it("karma KDV oranları ayrı gruplanır (H7)", () => {
    const catalog: Catalog = {
      ...SEED_CATALOG,
      variants: SEED_CATALOG.variants.map((v) =>
        v.id === "silimagen-60" ? { ...v, vatRate: 0.2 } : v,
      ),
    };
    const s = summarizeCart(catalog, settings, base);
    expect(s.vatGroups).toEqual([
      { rate: 0.01, baseMinor: 2000000, vatMinor: 20000 },
      { rate: 0.2, baseMinor: 990000, vatMinor: 198000 },
    ]);
    expect(s.grossMinor).toBe(2990000 + 20000 + 198000);
  });

  it("adet sınırları (H1): 0 satırı kaldırır, geçersiz değişmez", () => {
    const v = variant("gardegen-60");
    expect(setQty(base, v, 0).lines).toHaveLength(1);
    expect(setQty(base, v, 10000)).toBe(base);
    expect(setQty(base, v, 2.5)).toBe(base);
    expect(setQty(base, v, -1)).toBe(base);
  });

  it("gizlenen ürün sepetten düşer (D7), fiyat değişimi işaretlenir (D8)", () => {
    const catalog: Catalog = {
      ...SEED_CATALOG,
      variants: SEED_CATALOG.variants.map((v) =>
        v.id === "silimagen-60"
          ? { ...v, active: false }
          : v.id === "gardegen-60"
            ? { ...v, saleMinor: 210000 }
            : v,
      ),
    };
    const s = summarizeCart(catalog, settings, base);
    expect(s.droppedVariantIds).toEqual(["silimagen-60"]);
    expect(s.lines[0]?.priceChanged).toBe(true);
    expect(s.netMinor).toBe(2100000);
  });
});

describe("sipariş", () => {
  const stub = (no: string): Order => ({ no }) as Order;

  it("günlük sıra", () => {
    expect(nextOrderNo("VU", "2026-09-25", [])).toBe("VU-20260925-01");
    expect(nextOrderNo("VU", "2026-09-25", [stub("VU-20260925-01"), stub("VU-20260924-07")])).toBe(
      "VU-20260925-02",
    );
  });

  it("fiyat dondurulur ve dosya adı ASCII (P8)", () => {
    const cart = setQty(EMPTY_CART, variant("gardegen-60"), 10);
    const order = buildOrder(
      {
        no: "VU-20260925-01",
        createdAt: "2026-09-25T10:00:00.000Z",
        day: "2026-09-25",
        pharmacy: { name: " Şifa Eczanesi ", district: "", address: "", phone: "" },
        note: "",
        repName: "Volkan ULU",
        repPhone: "0 555 555 55 55",
        headerTitle: "Sipariş Formu",
      },
      summarizeCart(SEED_CATALOG, settings, cart),
    );
    expect(order.lines[0]).toMatchObject({ qty: 10, unitMinor: 200000, amountMinor: 2000000 });
    expect(order.pharmacy.name).toBe("Şifa Eczanesi");
    expect(orderFileName(order)).toBe("Siparis_sifa-eczanesi_2026-09-25_VU-20260925-01.png");
  });
});

describe("giriş okuma (H6)", () => {
  it.each([
    ["20,5", 0.205],
    ["%20", 0.2],
    ["20", 0.2],
    ["", null],
    ["abc", null],
  ])("oran %s → %s", (raw, expected) => {
    expect(parseRateInput(raw)).toBe(expected);
  });

  it.each([
    ["1.116,67", 111667],
    ["₺1.116,67", 111667],
    ["2000", 200000],
    ["", null],
  ])("tutar %s → %s", (raw, expected) => {
    expect(parseMoneyInput(raw)).toBe(expected);
  });

  it("adet yalnız rakam", () => {
    expect(parseQtyInput("12a")).toBe(12);
    expect(parseQtyInput("")).toBe(0);
  });

  it.each([
    [0.2, "20"],
    [0.205, "20,5"],
    [0.01, "1"],
  ])("oran kutusu %d → %s", (rate, shown) => {
    expect(rateToInput(rate)).toBe(shown);
  });
});

describe("para kutusu — giriş alanları standardı §1 (GHS-Panel moneyInputStep)", () => {
  /** Tuş tuş yazmayı taklit eder; reddedilen tuş kutuyu değiştirmez. */
  function typeInto(keys: string): string {
    let shown = "";
    for (const key of keys) {
      const step = moneyInputStep(shown, shown + key);
      if (step.ok) shown = step.text;
    }
    return shown;
  }

  it("tuş tuş 85340,50 → 85.340,50; binlik kendiliğinden, kuruş korunur", () => {
    expect(typeInto("85340,50")).toBe("85.340,50");
    expect(parseMoneyInput("85.340,50")).toBe(8534050);
  });

  it.each([
    ["85.340,50", "85.340,50", 8534050],
    ["₺1.234", "1.234", 123400],
    ["₺1.234,56", "1.234,56", 123456],
    ["12.500", "12.500", 1250000],
  ])("yapıştırma %s → %s (100/1000 kat sapma yok)", (pasted, shown, minor) => {
    expect(moneyInputStep("", pasted)).toEqual({ ok: true, text: shown });
    expect(parseMoneyInput(shown)).toBe(minor);
  });

  it.each([
    ["98.5", MONEY_INPUT_MESSAGES.useComma],
    ["1.23", MONEY_INPUT_MESSAGES.useComma],
    ["12a", MONEY_INPUT_MESSAGES.invalidChar],
    ["-100", MONEY_INPUT_MESSAGES.invalidChar],
    ["1,2,3", MONEY_INPUT_MESSAGES.oneComma],
  ])("reddedilir %s", (pasted, message) => {
    expect(moneyInputStep("", pasted)).toEqual({ ok: false, message });
  });

  it("nokta tuşu reddedilir; silme serbest", () => {
    expect(moneyInputStep("98", "98.")).toEqual({
      ok: false,
      message: MONEY_INPUT_MESSAGES.useComma,
    });
    expect(moneyInputStep("1.234", "1.23")).toEqual({ ok: true, text: "123" });
  });

  it("harf ve üçüncü kuruş hanesi kutuya girmez", () => {
    expect(typeInto("1234,567")).toBe("1.234,56");
    expect(typeInto("12a3")).toBe("123");
  });

  it("adet ve telefon: yalnız rakam (ABACUS text.digits)", () => {
    expect(qtyInput("12a345")).toBe("1234");
    expect(phoneInput("0532 abc 123-45-67 99")).toBe("05321234567");
    expect(phoneDisplay("05321234567")).toBe("+90 (532) 123 45 67");
  });
});
