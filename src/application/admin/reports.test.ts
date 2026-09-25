import { describe, expect, it } from "vitest";
import { SEED_CATALOG } from "../../composition/seed/seed.ts";
import type { CostBook } from "../../domain/costs/costs.ts";
import type { Order, OrderLine } from "../../domain/order/order.ts";
import { demoCosts, demoOrders } from "./demoOrders.ts";
import { bucketStarts, buildReport, changeRate, planPeriod, weekStart } from "./reports.ts";

/** Beklenen değerler elle hesaplandı (yorumlarda). 25.09.2026 cuma; hafta pazartesi 21.09. */
const TODAY = "2026-09-25";

function order(no: string, day: string, pharmacy: string, lines: OrderLine[]): Order {
  const net = lines.reduce((a, l) => a + l.amountMinor, 0);
  return {
    no,
    createdAt: `${day}T09:00:00.000Z`,
    day,
    pharmacy: { name: pharmacy, district: "", address: "", phone: "" },
    note: "",
    repName: "Volkan ULU",
    repPhone: "",
    headerTitle: "Sipariş Formu",
    lines,
    netMinor: net,
    vatGroups: [],
    grossMinor: net,
    status: "shared",
    shareCount: 1,
  };
}

const line = (variantId: string, qty: number, mf: number, unitMinor: number): OrderLine => ({
  variantId,
  label: variantId,
  qty,
  mf,
  unitMinor,
  amountMinor: qty * unitMinor,
  vatRate: 0.01,
});

const COSTS: CostBook = {
  "gardegen-60": {
    variantId: "gardegen-60",
    costMinor: 120000,
    policy: { kind: "fixed_price", priceMinor: 200000 },
  },
};

const ORDERS = [
  // Bu hafta: 10 kutu + 1 MF × 2.000 = 20.000; alış 11 × 1.200 = 13.200 → kâr 6.800
  order("A", "2026-09-22", "Şifa Eczanesi", [line("gardegen-60", 10, 1, 200000)]),
  // Bu hafta: alışı girilmemiş → 9.900 ciro, kâr bilinmiyor
  order("B", "2026-09-25", "Deva Eczanesi", [line("silimagen-60", 12, 0, 82500)]),
  // Geçen hafta (14–18 Eyl.): 5 × 458 = 2.290
  order("C", "2026-09-18", "Şifa Eczanesi", [line("magmeda-60", 5, 0, 45800)]),
];

describe("dönem planı (ABACUS tarih)", () => {
  it("hafta pazartesi başlar", () => {
    expect(weekStart("2026-09-25")).toBe("2026-09-21");
    expect(weekStart("2026-09-21")).toBe("2026-09-21");
    expect(weekStart("2026-09-27")).toBe("2026-09-21");
  });

  it.each([
    ["week", "2026-09-21", "2026-09-25", "2026-09-14", "2026-09-18", "day"],
    ["month", "2026-09-01", "2026-09-25", "2026-08-01", "2026-08-25", "day"],
    ["quarter", "2026-06-28", "2026-09-25", "2026-03-30", "2026-06-27", "week"],
    ["year", "2026-01-01", "2026-09-25", "2025-01-01", "2025-09-25", "month"],
  ] as const)("%s → %s…%s, önceki %s…%s, dilim %s", (p, s, e, ps, pe, b) => {
    expect(planPeriod(p, TODAY, null)).toEqual({
      current: { start: s, end: e },
      previous: { start: ps, end: pe },
      bucket: b,
    });
  });

  it("ay sonu taşmaz: 31 Mart'ın önceki dönemi 28 Şubat'ta biter", () => {
    expect(planPeriod("month", "2026-03-31", null).previous).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
    });
  });

  it("dilimler", () => {
    expect(bucketStarts({ start: "2026-09-21", end: "2026-09-25" }, "day")).toHaveLength(5);
    expect(bucketStarts({ start: "2026-01-01", end: "2026-09-25" }, "month")).toHaveLength(9);
    expect(bucketStarts({ start: "2026-09-01", end: "2026-09-25" }, "week")[0]).toBe("2026-08-31");
  });
});

describe("rapor hesabı", () => {
  const report = buildReport(ORDERS, SEED_CATALOG, COSTS, "week", TODAY);

  it("toplamlar: kâr MF alışını düşer, alışı olmayan ciro ayrı", () => {
    expect(report.totals).toEqual({
      revenueMinor: 2990000,
      profitMinor: 680000,
      costedRevenueMinor: 2000000,
      uncostedRevenueMinor: 990000,
      mfCostMinor: 120000,
      orders: 2,
      boxes: 22,
      mfBoxes: 1,
      pharmacies: 2,
      avgOrderMinor: 1495000,
      marginRate: 0.34,
    });
  });

  it("önceki dönem: alış yoksa kâr null (0 değil)", () => {
    expect(report.previous?.revenueMinor).toBe(229000);
    expect(report.previous?.profitMinor).toBeNull();
    expect(changeRate(2990000, 229000)).toBeCloseTo(12.0568, 3);
    expect(changeRate(100, 0)).toBeNull();
  });

  it("günlük dilim: salı satırı", () => {
    expect(report.buckets.map((b) => b.start)).toEqual([
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
    ]);
    expect(report.buckets[1]).toEqual({
      start: "2026-09-22",
      revenueMinor: 2000000,
      costMinor: 1320000,
      profitMinor: 680000,
      uncostedRevenueMinor: 0,
      orders: 1,
    });
  });

  it("ürün, grup ve eczane sıralaması ciroya göre", () => {
    expect(report.products.map((p) => [p.variantId, p.revenueMinor, p.profitMinor])).toEqual([
      ["gardegen-60", 2000000, 680000],
      ["silimagen-60", 990000, null],
    ]);
    expect(report.products[0]).toMatchObject({ groupName: "Gardegen", variantName: "60 Kapsül" });
    expect(report.groups.map((g) => g.name)).toEqual(["Gardegen", "Silimagen"]);
    expect(report.pharmacies.map((p) => [p.name, p.orders])).toEqual([
      ["Şifa Eczanesi", 1],
      ["Deva Eczanesi", 1],
    ]);
  });

  it("örnek veri tekrarlanabilir ve kayıtlara benzemez (DEMO no)", () => {
    const a = demoOrders(SEED_CATALOG, TODAY);
    const b = demoOrders(SEED_CATALOG, TODAY);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(100);
    expect(a.every((o) => o.no.startsWith("DEMO-"))).toBe(true);
    const r = buildReport(a, SEED_CATALOG, demoCosts(SEED_CATALOG, {}), "year", TODAY);
    expect(r.totals.uncostedRevenueMinor).toBe(0);
    expect(r.totals.profitMinor).not.toBeNull();
  });
});
