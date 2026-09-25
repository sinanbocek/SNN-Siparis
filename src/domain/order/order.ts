import { math, text, type MinorAmount, type Rate } from "../abacus/index.ts";
import type { CartSummary, PharmacyDraft, VatGroup } from "../cart/cart.ts";

export type OrderStatus = "ready" | "shared";

export interface OrderLine {
  readonly variantId: string;
  readonly label: string;
  readonly qty: number;
  readonly mf: number;
  readonly unitMinor: MinorAmount;
  readonly amountMinor: MinorAmount;
  readonly vatRate: Rate;
}

/** Kaydedilen sipariş: fiyatlar dondurulmuş anlık görüntüdür; sonraki fiyat değişikliği etkilemez. */
export interface Order {
  readonly no: string;
  /** ISO damga (UTC). */
  readonly createdAt: string;
  /** Sıra için İstanbul takvim günü, YYYY-MM-DD. */
  readonly day: string;
  readonly pharmacy: PharmacyDraft;
  readonly note: string;
  readonly repName: string;
  readonly repPhone: string;
  readonly headerTitle: string;
  readonly lines: readonly OrderLine[];
  readonly netMinor: MinorAmount;
  readonly vatGroups: readonly VatGroup[];
  readonly grossMinor: MinorAmount;
  readonly status: OrderStatus;
  readonly shareCount: number;
}

/** Sipariş no: önek + gün + günlük sıra → VU-20260925-01. */
export function nextOrderNo(prefix: string, day: string, existing: readonly Order[]): string {
  const compactDay = day.split("-").join("");
  const head = `${prefix}-${compactDay}-`;
  const used = existing
    .filter((o) => o.no.startsWith(head))
    .map((o) => Number(o.no.slice(head.length)))
    .filter((n) => Number.isSafeInteger(n));
  const highest = math.max(...used);
  const next = highest === null ? 1 : math.add(highest, 1);
  return `${head}${String(next).padStart(2, "0")}`;
}

export interface OrderInput {
  readonly no: string;
  readonly createdAt: string;
  readonly day: string;
  readonly pharmacy: PharmacyDraft;
  readonly note: string;
  readonly repName: string;
  readonly repPhone: string;
  readonly headerTitle: string;
}

export function buildOrder(input: OrderInput, summary: CartSummary): Order {
  return {
    ...input,
    pharmacy: {
      name: input.pharmacy.name.trim(),
      district: input.pharmacy.district.trim(),
      address: input.pharmacy.address.trim(),
      phone: input.pharmacy.phone.trim(),
    },
    note: input.note.trim(),
    lines: summary.lines.map((l) => ({
      variantId: l.variantId,
      label: l.label,
      qty: l.qty,
      mf: l.mf,
      unitMinor: l.unitMinor,
      amountMinor: l.amountMinor,
      vatRate: l.vatRate,
    })),
    netMinor: summary.netMinor,
    vatGroups: summary.vatGroups,
    grossMinor: summary.grossMinor,
    status: "ready",
    shareCount: 0,
  };
}

export function markShared(order: Order): Order {
  return { ...order, status: "shared", shareCount: math.add(order.shareCount, 1) };
}

/** Siparis_<eczane-ascii>_<YYYY-MM-DD>_<no>.png (P8). */
export function orderFileName(order: Order): string {
  const slug = text
    .searchKey(order.pharmacy.name)
    .split(" ")
    .filter((part) => part.length > 0)
    .join("-")
    .replace(/[^a-z0-9-]/g, "");
  const safe = slug.length > 0 ? slug : "eczane";
  return `Siparis_${safe}_${order.day}_${order.no}.png`;
}

export function canShare(pharmacy: PharmacyDraft, lineCount: number): boolean {
  return pharmacy.name.trim().length > 0 && lineCount > 0;
}
