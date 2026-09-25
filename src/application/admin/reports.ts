import {
  date,
  math,
  period,
  text,
  type MinorAmount,
  type Rate,
} from "../../domain/abacus/index.ts";
import { familyOf, findVariant, type Catalog } from "../../domain/catalog/catalog.ts";
import type { CostBook } from "../../domain/costs/costs.ts";
import type { Order } from "../../domain/order/order.ts";

/**
 * Yönetici raporu — satış, kâr, en çok satanlar, ürün grupları, eczaneler.
 * Yalnız yönetim tarafı (maliyet kullanır, ADR-0002). Saf hesap; tarih ve para ABACUS ile.
 *
 * Kâr bugünkü alış fiyatıyla hesaplanır (sipariş anında alış saklanmaz): satır kârı =
 * tutar − alış × (adet + MF). MF kutuların alışı da kârdan düşer. Alışı girilmemiş ürünün
 * kârı bilinmez; 0 sayılmaz, "alışı girilmemiş ciro" olarak ayrı tutulur.
 */

export type ReportPeriod = "week" | "month" | "quarter" | "year" | "all";
export type BucketSize = "day" | "week" | "month";

export interface DayRange {
  /** Dahil, YYYY-MM-DD */
  readonly start: string;
  readonly end: string;
}

export interface PeriodPlan {
  readonly current: DayRange;
  /** Karşılaştırma dönemi (aynı uzunlukta, hemen önce); "tümü"nde yok. */
  readonly previous: DayRange | null;
  readonly bucket: BucketSize;
}

function addDays(iso: string, days: number): string {
  const next = period.addDays(iso, days);
  if (next === null) throw new Error(`Tarih hesaplanamadı: ${iso}`);
  return next;
}

function monthStart(iso: string): string {
  const start = period.startOfMonth(iso);
  if (start === null) throw new Error(`Ay başı hesaplanamadı: ${iso}`);
  return start;
}

/** Pazartesi başlangıçlı hafta. */
export function weekStart(iso: string): string {
  const wd = date.weekday(iso);
  if (wd === null) throw new Error(`Hafta günü okunamadı: ${iso}`);
  const back = wd === 0 ? 6 : math.sub(wd, 1);
  return addDays(iso, math.mul(back, -1));
}

function daysIn(range: DayRange): number {
  const days = date.daysBetween(range.start, range.end);
  return days === null ? 0 : days;
}

/** Dönemin aralığı, karşılaştırma aralığı ve grafik dilimi. */
export function planPeriod(p: ReportPeriod, today: string, firstDay: string | null): PeriodPlan {
  switch (p) {
    case "week": {
      const current = { start: weekStart(today), end: today };
      const span = daysIn(current);
      const prevStart = addDays(current.start, -7);
      return {
        current,
        previous: { start: prevStart, end: addDays(prevStart, span) },
        bucket: "day",
      };
    }
    case "month": {
      const current = { start: monthStart(today), end: today };
      const prevStart = monthStart(addDays(current.start, -1));
      const prevEndCandidate = addDays(prevStart, daysIn(current));
      const prevMonthEnd = addDays(current.start, -1);
      const prevEnd = prevEndCandidate > prevMonthEnd ? prevMonthEnd : prevEndCandidate;
      return { current, previous: { start: prevStart, end: prevEnd }, bucket: "day" };
    }
    case "quarter": {
      const current = { start: addDays(today, -89), end: today };
      return {
        current,
        previous: { start: addDays(current.start, -90), end: addDays(current.start, -1) },
        bucket: "week",
      };
    }
    case "year": {
      const start = `${today.slice(0, 4)}-01-01`;
      const current = { start, end: today };
      const prevYear = String(math.sub(Number(today.slice(0, 4)), 1));
      const prevStart = `${prevYear}-01-01`;
      return {
        current,
        previous: { start: prevStart, end: addDays(prevStart, daysIn(current)) },
        bucket: "month",
      };
    }
    case "all": {
      const start = firstDay !== null && firstDay < today ? firstDay : today;
      const span = daysIn({ start, end: today });
      return {
        current: { start, end: today },
        previous: null,
        bucket: span > 62 ? "month" : "day",
      };
    }
  }
}

export function inRange(day: string, range: DayRange): boolean {
  return day >= range.start && day <= range.end;
}

/** Aralığı dilimlere böler; her dilimin anahtarı başlangıç günüdür. */
export function bucketStarts(range: DayRange, size: BucketSize): string[] {
  const keys: string[] = [];
  let cursor =
    size === "day"
      ? range.start
      : size === "week"
        ? weekStart(range.start)
        : monthStart(range.start);
  while (cursor <= range.end) {
    keys.push(cursor);
    if (size === "day") cursor = addDays(cursor, 1);
    else if (size === "week") cursor = addDays(cursor, 7);
    else {
      const next = period.addMonths(cursor, 1);
      if (next === null) break;
      cursor = next;
    }
  }
  return keys;
}

export function bucketOf(day: string, size: BucketSize): string {
  if (size === "day") return day;
  if (size === "week") return weekStart(day);
  return monthStart(day);
}

export interface ReportTotals {
  /** KDV hariç ciro (eczaneye satışım). */
  readonly revenueMinor: MinorAmount;
  /** Alışı bilinen satırların kârı; hiç bilinen yoksa null. */
  readonly profitMinor: MinorAmount | null;
  /** Kârı hesaplanabilen ciro. */
  readonly costedRevenueMinor: MinorAmount;
  /** Alışı girilmemiş ürünlerin cirosu. */
  readonly uncostedRevenueMinor: MinorAmount;
  /** MF kutuların alış tutarı (bedava verilen mal). */
  readonly mfCostMinor: MinorAmount;
  readonly orders: number;
  readonly boxes: number;
  readonly mfBoxes: number;
  readonly pharmacies: number;
  readonly avgOrderMinor: MinorAmount | null;
  /** Kâr ÷ kârı hesaplanabilen ciro. */
  readonly marginRate: Rate | null;
}

export interface ProductRow {
  readonly variantId: string;
  readonly groupName: string;
  readonly variantName: string;
  readonly qty: number;
  readonly mf: number;
  readonly revenueMinor: MinorAmount;
  readonly profitMinor: MinorAmount | null;
}

export interface GroupRow {
  readonly key: string;
  readonly name: string;
  readonly qty: number;
  readonly revenueMinor: MinorAmount;
  readonly profitMinor: MinorAmount | null;
}

export interface PharmacyRow {
  readonly key: string;
  readonly name: string;
  readonly orders: number;
  readonly revenueMinor: MinorAmount;
  readonly lastDay: string;
}

export interface BucketRow {
  readonly start: string;
  readonly revenueMinor: MinorAmount;
  /** Alışı bilinen satırların alış tutarı (MF dahil). */
  readonly costMinor: MinorAmount;
  readonly profitMinor: MinorAmount;
  readonly uncostedRevenueMinor: MinorAmount;
  readonly orders: number;
}

export interface Report {
  readonly plan: PeriodPlan;
  readonly totals: ReportTotals;
  readonly previous: ReportTotals | null;
  readonly buckets: readonly BucketRow[];
  readonly products: readonly ProductRow[];
  readonly groups: readonly GroupRow[];
  readonly pharmacies: readonly PharmacyRow[];
}

interface LineFacts {
  readonly revenue: MinorAmount;
  readonly cost: MinorAmount | null;
  readonly mfCost: MinorAmount | null;
}

function lineFacts(costs: CostBook, line: Order["lines"][number]): LineFacts {
  const entry = costs[line.variantId];
  const unitCost = entry === undefined ? null : entry.costMinor;
  if (unitCost === null) return { revenue: line.amountMinor, cost: null, mfCost: null };
  return {
    revenue: line.amountMinor,
    cost: math.mul(unitCost, math.add(line.qty, line.mf)),
    mfCost: math.mul(unitCost, line.mf),
  };
}

function totalsOf(orders: readonly Order[], costs: CostBook): ReportTotals {
  let revenue = 0;
  let profit = 0;
  let costed = 0;
  let uncosted = 0;
  let mfCost = 0;
  let boxes = 0;
  let mfBoxes = 0;
  let anyCost = false;
  const pharmacies = new Set<string>();
  for (const order of orders) {
    pharmacies.add(text.searchKey(order.pharmacy.name));
    for (const line of order.lines) {
      const f = lineFacts(costs, line);
      revenue = math.add(revenue, f.revenue);
      boxes = math.add(boxes, line.qty);
      mfBoxes = math.add(mfBoxes, line.mf);
      if (f.cost === null) {
        uncosted = math.add(uncosted, f.revenue);
        continue;
      }
      anyCost = true;
      costed = math.add(costed, f.revenue);
      profit = math.add(profit, math.sub(f.revenue, f.cost));
      mfCost = math.add(mfCost, f.mfCost === null ? 0 : f.mfCost);
    }
  }
  const avg = orders.length > 0 ? math.div(revenue, orders.length) : null;
  return {
    revenueMinor: revenue,
    profitMinor: anyCost ? profit : null,
    costedRevenueMinor: costed,
    uncostedRevenueMinor: uncosted,
    mfCostMinor: mfCost,
    orders: orders.length,
    boxes,
    mfBoxes,
    pharmacies: pharmacies.size,
    avgOrderMinor: avg === null ? null : math.round(avg, 0),
    marginRate: anyCost && costed > 0 ? math.div(profit, costed) : null,
  };
}

/** Raporun tamamı. Sıralamalar ciroya göre büyükten küçüğe. */
export function buildReport(
  orders: readonly Order[],
  catalog: Catalog,
  costs: CostBook,
  p: ReportPeriod,
  today: string,
): Report {
  const firstDay = orders.reduce<string | null>(
    (min, o) => (min === null || o.day < min ? o.day : min),
    null,
  );
  const plan = planPeriod(p, today, firstDay);
  const current = orders.filter((o) => inRange(o.day, plan.current));
  const previous =
    plan.previous === null ? null : orders.filter((o) => inRange(o.day, plan.previous as DayRange));

  const buckets = new Map<
    string,
    { revenue: number; cost: number; profit: number; uncosted: number; orders: number }
  >();
  for (const key of bucketStarts(plan.current, plan.bucket)) {
    buckets.set(key, { revenue: 0, cost: 0, profit: 0, uncosted: 0, orders: 0 });
  }
  const products = new Map<
    string,
    {
      groupName: string;
      variantName: string;
      qty: number;
      mf: number;
      revenue: number;
      profit: number;
      costed: boolean;
    }
  >();
  const groups = new Map<
    string,
    { name: string; qty: number; revenue: number; profit: number; costed: boolean }
  >();
  const pharmacies = new Map<
    string,
    { name: string; orders: number; revenue: number; lastDay: string }
  >();

  for (const order of current) {
    const bucket = buckets.get(bucketOf(order.day, plan.bucket));
    if (bucket) bucket.orders = math.add(bucket.orders, 1);
    const pKey = text.searchKey(order.pharmacy.name);
    const ph = pharmacies.get(pKey) ?? {
      name: order.pharmacy.name,
      orders: 0,
      revenue: 0,
      lastDay: order.day,
    };
    ph.orders = math.add(ph.orders, 1);
    ph.revenue = math.add(ph.revenue, order.netMinor);
    if (order.day >= ph.lastDay) {
      ph.lastDay = order.day;
      ph.name = order.pharmacy.name;
    }
    pharmacies.set(pKey, ph);

    for (const line of order.lines) {
      const f = lineFacts(costs, line);
      const lineProfit = f.cost === null ? null : math.sub(f.revenue, f.cost);
      if (bucket) {
        bucket.revenue = math.add(bucket.revenue, f.revenue);
        if (f.cost === null || lineProfit === null)
          bucket.uncosted = math.add(bucket.uncosted, f.revenue);
        else {
          bucket.cost = math.add(bucket.cost, f.cost);
          bucket.profit = math.add(bucket.profit, lineProfit);
        }
      }
      const variant = findVariant(catalog, line.variantId);
      const family = variant ? familyOf(catalog, variant) : undefined;
      const groupName = family ? family.name : "Katalogda olmayan";
      const variantName = variant ? variant.name : line.label;
      const pr = products.get(line.variantId) ?? {
        groupName,
        variantName,
        qty: 0,
        mf: 0,
        revenue: 0,
        profit: 0,
        costed: false,
      };
      pr.qty = math.add(pr.qty, line.qty);
      pr.mf = math.add(pr.mf, line.mf);
      pr.revenue = math.add(pr.revenue, f.revenue);
      if (lineProfit !== null) {
        pr.profit = math.add(pr.profit, lineProfit);
        pr.costed = true;
      }
      products.set(line.variantId, pr);

      const gKey = family ? family.id : "_none";
      const gr = groups.get(gKey) ?? {
        name: groupName,
        qty: 0,
        revenue: 0,
        profit: 0,
        costed: false,
      };
      gr.qty = math.add(gr.qty, line.qty);
      gr.revenue = math.add(gr.revenue, f.revenue);
      if (lineProfit !== null) {
        gr.profit = math.add(gr.profit, lineProfit);
        gr.costed = true;
      }
      groups.set(gKey, gr);
    }
  }

  const byRevenue = <T extends { revenueMinor: number }>(a: T, b: T) =>
    b.revenueMinor - a.revenueMinor;

  return {
    plan,
    totals: totalsOf(current, costs),
    previous: previous === null ? null : totalsOf(previous, costs),
    buckets: [...buckets.entries()].map(([start, b]) => ({
      start,
      revenueMinor: b.revenue,
      costMinor: b.cost,
      profitMinor: b.profit,
      uncostedRevenueMinor: b.uncosted,
      orders: b.orders,
    })),
    products: [...products.entries()]
      .map(([variantId, r]) => ({
        variantId,
        groupName: r.groupName,
        variantName: r.variantName,
        qty: r.qty,
        mf: r.mf,
        revenueMinor: r.revenue,
        profitMinor: r.costed ? r.profit : null,
      }))
      .sort(byRevenue),
    groups: [...groups.entries()]
      .map(([key, r]) => ({
        key,
        name: r.name,
        qty: r.qty,
        revenueMinor: r.revenue,
        profitMinor: r.costed ? r.profit : null,
      }))
      .sort(byRevenue),
    pharmacies: [...pharmacies.entries()]
      .map(([key, r]) => ({
        key,
        name: r.name,
        orders: r.orders,
        revenueMinor: r.revenue,
        lastDay: r.lastDay,
      }))
      .sort(byRevenue),
  };
}

/** Önceki döneme göre değişim oranı; önceki 0 ya da yoksa null. */
export function changeRate(current: number | null, previous: number | null): Rate | null {
  if (current === null || previous === null || previous <= 0) return null;
  const ratio = math.div(math.sub(current, previous), previous);
  return ratio;
}
