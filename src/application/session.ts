import { date, text } from "../domain/abacus/index.ts";
import type { Catalog, Variant } from "../domain/catalog/catalog.ts";
import type { Order } from "../domain/order/order.ts";
import type { ImageMap } from "./ports/stores.ts";

/** ISO damgasının İstanbul takvim günü: YYYY-MM-DD. */
export function istanbulDay(iso: string): string {
  const parsed = date.parse(date.format(iso));
  if (parsed === null) throw new Error(`Tarih okunamadı: ${iso}`);
  return parsed;
}

/** Görsel sırası: varyant → aile → yok (yer tutucu). Kullanıcı yüklemesi başlangıcı ezer. */
export function imageFor(
  images: ImageMap,
  familyId: string,
  variantId: string | null,
): string | null {
  if (variantId !== null) {
    const own = images[`variant:${variantId}`];
    if (own !== undefined) return own;
  }
  const family = images[`family:${familyId}`];
  return family === undefined ? null : family;
}

/** Katalog araması (Türkçe harfler katlanır: "cagri" → "Çağrı"). */
export function matchesSearch(catalog: Catalog, variant: Variant, query: string): boolean {
  const key = text.searchKey(query);
  if (key.length === 0) return true;
  const family = catalog.families.find((f) => f.id === variant.familyId);
  const haystack = text.searchKey(`${family ? family.name : ""} ${variant.name}`);
  return key.split(" ").every((part) => haystack.includes(part));
}

/** Geçmişteki eczane adları (otomatik tamamlama), en yeni önce, tekil. */
export function knownPharmacies(orders: readonly Order[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const order of [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const key = text.searchKey(order.pharmacy.name);
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    names.push(order.pharmacy.name);
  }
  return names;
}

export type OrderFilter = "today" | "week" | "all";

export function filterOrders(
  orders: readonly Order[],
  filter: OrderFilter,
  query: string,
  today: string,
): Order[] {
  const key = text.searchKey(query);
  return [...orders]
    .filter((o) => {
      if (filter === "today" && o.day !== today) return false;
      if (filter === "week") {
        const days = date.daysBetween(o.day, today);
        if (days === null || days > 6 || days < 0) return false;
      }
      return key.length === 0 || text.searchKey(o.pharmacy.name).includes(key);
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
