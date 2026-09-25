import { math, period, type MinorAmount } from "../../domain/abacus/index.ts";
import { variantLabel, type Catalog } from "../../domain/catalog/catalog.ts";
import { estimateCostFromSale, type CostBook } from "../../domain/costs/costs.ts";
import type { Order, OrderLine } from "../../domain/order/order.ts";
import { vatOnMinor } from "../../domain/pricing/pricing.ts";

/**
 * Rapor sayfasının "örnek veriyle göster" önizlemesi. Deterministik (her açılışta aynı);
 * cihaza KAYDEDİLMEZ. Eczane adları uydurmadır, gerçek kişi/kurum değildir.
 */

const DEMO_PHARMACIES = [
  "Şifa Eczanesi",
  "Hayat Eczanesi",
  "Deva Eczanesi",
  "Merkez Eczanesi",
  "Nur Eczanesi",
  "Güven Eczanesi",
  "Yaşam Eczanesi",
  "Sağlık Eczanesi",
  "Umut Eczanesi",
  "Doğa Eczanesi",
  "Pınar Eczanesi",
  "Kent Eczanesi",
];

/**
 * Park–Miller üreteci (tekrarlanabilir). Çarpım 2^47 altında kalır; güvenli tam sayı
 * sınırı aşılmaz (büyük çarpanlı üreteçte alt bitler kayboluyordu).
 */
const MODULUS = 2147483647;

function createRandom(seed: number) {
  let state = seed % MODULUS;
  return (limit: number): number => {
    state = math.mul(state, 48271) % MODULUS;
    const scaled = math.div(math.mul(state, limit), MODULUS);
    return scaled === null ? 0 : math.floor(scaled);
  };
}

export function demoOrders(catalog: Catalog, today: string, days = 180): Order[] {
  const random = createRandom(20260925);
  const variants = catalog.variants.filter((v) => v.active && v.saleMinor !== null);
  // Popülerlik ağırlığı: katalog sırası öne çıkanları biraz daha sık seçer.
  const weighted = variants.flatMap((v, i) => Array.from({ length: math.sub(6, i % 6) }, () => v));
  const orders: Order[] = [];
  for (let back = days; back >= 0; back -= 1) {
    const day = period.addDays(today, -back);
    if (day === null) continue;
    const perDay = random(4);
    for (let n = 0; n < perDay; n += 1) {
      const lineCount = math.add(1, random(4));
      const picked = new Map<string, OrderLine>();
      for (let l = 0; l < lineCount; l += 1) {
        const v = weighted[random(weighted.length)];
        if (!v || v.saleMinor === null || picked.has(v.id)) continue;
        const qty = math.add(3, random(22));
        const tens = math.div(qty, 10);
        const mf = qty >= 10 && tens !== null ? math.floor(tens) : 0;
        picked.set(v.id, {
          variantId: v.id,
          label: variantLabel(catalog, v),
          qty,
          mf: mf,
          unitMinor: v.saleMinor,
          amountMinor: math.mul(qty, v.saleMinor),
          vatRate: 0.01,
        });
      }
      const lines = [...picked.values()];
      if (lines.length === 0) continue;
      const net: MinorAmount = lines.reduce((a, l) => math.add(a, l.amountMinor), 0);
      const vat = vatOnMinor(net, 0.01);
      const seq = String(math.add(n, 1)).padStart(2, "0");
      const hour = String(math.add(9, random(9))).padStart(2, "0");
      orders.push({
        no: `DEMO-${day.split("-").join("")}-${seq}`,
        createdAt: `${day}T${hour}:00:00.000Z`,
        day,
        pharmacy: {
          name: DEMO_PHARMACIES[random(DEMO_PHARMACIES.length)] ?? "Örnek Eczane",
          district: "",
          address: "",
          phone: "",
        },
        note: "",
        repName: "Örnek",
        repPhone: "",
        headerTitle: "Sipariş Formu",
        lines,
        netMinor: net,
        vatGroups: [{ rate: 0.01, baseMinor: net, vatMinor: vat }],
        grossMinor: math.add(net, vat),
        status: "shared",
        shareCount: 1,
      });
    }
  }
  return orders;
}

/** Örnekte alışı girilmemiş ürünlere %40 marj tahmini (yalnız önizleme için). */
export function demoCosts(catalog: Catalog, costs: CostBook): CostBook {
  const filled: Record<string, CostBook[string]> = { ...costs };
  for (const v of catalog.variants) {
    const entry = filled[v.id];
    if (v.saleMinor === null || (entry !== undefined && entry.costMinor !== null)) continue;
    filled[v.id] = {
      variantId: v.id,
      costMinor: estimateCostFromSale(v.saleMinor),
      policy: { kind: "fixed_price", priceMinor: v.saleMinor },
    };
  }
  return filled;
}
