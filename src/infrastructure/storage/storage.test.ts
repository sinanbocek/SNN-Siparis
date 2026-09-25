import { describe, expect, it } from "vitest";
import { backupFileName, buildBackup, parseBackup } from "../../application/admin/backup.ts";
import {
  applyCostEntry,
  bulkAdjust,
  estimateMissingCosts,
  rederiveSales,
} from "../../application/admin/pricing.ts";
import { isCatalog } from "../../application/validation.ts";
import { SEED_CATALOG } from "../../composition/seed/seed.ts";
import { DEFAULT_SETTINGS } from "../../domain/settings/settings.ts";
import { createLocalDocumentStore, type KeyValueStorage } from "./localDocumentStore.ts";
import { createCostStore, createSalesStores } from "./stores.ts";

class MemoryStorage implements KeyValueStorage {
  data = new Map<string, string>();
  quota = Number.POSITIVE_INFINITY;
  get length() {
    return this.data.size;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (v.length > this.quota) throw new DOMException("dolu", "QuotaExceededError");
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

describe("cihaz deposu", () => {
  it("boş depo null döner, kayıt sürüm zarfıyla geri okunur", () => {
    const mem = new MemoryStorage();
    const stores = createSalesStores(mem);
    expect(stores.catalog.load()).toEqual({ ok: true, value: null });
    expect(stores.catalog.save(SEED_CATALOG)).toEqual({ ok: true });
    expect(stores.catalog.load()).toEqual({ ok: true, value: SEED_CATALOG });
    expect(mem.getItem("snn-siparis.catalog")).toContain('"version":1');
  });

  it("depo yoksa unavailable (D2)", () => {
    const stores = createSalesStores(null);
    expect(stores.settings.load()).toEqual({ ok: false, reason: "unavailable" });
    expect(stores.settings.save(DEFAULT_SETTINGS)).toEqual({ ok: false, reason: "unavailable" });
  });

  it("bozuk kayıt: okuma silmez, yazmadan önce yedeğe kopyalanır (D4)", () => {
    const mem = new MemoryStorage();
    mem.setItem("snn-siparis.catalog", "{bozuk");
    const store = createLocalDocumentStore(mem, "catalog", isCatalog);
    expect(store.load()).toEqual({ ok: false, reason: "corrupt" });
    expect(mem.getItem("snn-siparis.catalog")).toBe("{bozuk");
    expect(store.save(SEED_CATALOG).ok).toBe(true);
    expect(mem.getItem("snn-siparis.catalog.corrupt-backup")).toBe("{bozuk");
  });

  it("kota dolunca quota döner, eski veri bozulmaz (D3)", () => {
    const mem = new MemoryStorage();
    const stores = createSalesStores(mem);
    stores.images.save({ "family:x": "data:a" });
    mem.quota = 10;
    expect(stores.images.save({ "family:x": "data:çok-büyük-görsel" })).toEqual({
      ok: false,
      reason: "quota",
    });
    expect(stores.images.load()).toEqual({ ok: true, value: { "family:x": "data:a" } });
  });
});

describe("maliyet ve toplu fiyat (yönetim)", () => {
  const state = { catalog: SEED_CATALOG, costs: {} };

  it("maliyet + %50 kâr → satış yeniden türetilir; maliyet ayrı depoda", () => {
    const next = applyCostEntry(
      state,
      { variantId: "gardegen-60", costMinor: 100000, policy: { kind: "markup", rate: 0.5 } },
      100,
    );
    expect(next.catalog.variants.find((v) => v.id === "gardegen-60")?.saleMinor).toBe(150000);
    const mem = new MemoryStorage();
    createCostStore(mem).save(next.costs);
    expect(mem.getItem("snn-siparis.catalog")).toBeNull();
    expect(JSON.stringify(next.catalog)).not.toContain("costMinor");
  });

  it("toplu +%5 → 1 TL'ye yuvarlanır ve sabit fiyat olur", () => {
    const next = bulkAdjust(state, ["magmeda-60"], { kind: "percent", rate: 0.05 }, 100);
    // 458 × 1,05 = 480,90 → 481
    expect(next.catalog.variants.find((v) => v.id === "magmeda-60")?.saleMinor).toBe(48100);
    expect(next.costs["magmeda-60"]?.policy).toEqual({ kind: "fixed_price", priceMinor: 48100 });
  });

  it("%40 marjdan tahmin satışı değiştirmez; adım değişince yeniden türetilir (H10)", () => {
    const est = estimateMissingCosts(state, ["gardegen-60"]);
    expect(est.costs["gardegen-60"]?.costMinor).toBe(120000);
    const at10 = rederiveSales(est, 1000);
    expect(at10.catalog.variants.find((v) => v.id === "gardegen-60")?.saleMinor).toBe(200000);
    const krem = estimateMissingCosts(state, ["gardegen-krem"]);
    // 67.020 ÷ 0,60 = 1.117 → 10 TL adımında 1.120
    expect(
      rederiveSales(krem, 1000).catalog.variants.find((v) => v.id === "gardegen-krem")?.saleMinor,
    ).toBe(112000);
  });
});

describe("yedek (F, D6, G5)", () => {
  const backup = buildBackup({
    exportedAt: "2026-09-25T10:00:00.000Z",
    settings: DEFAULT_SETTINGS,
    catalog: SEED_CATALOG,
    orders: [],
    meta: { installedAt: "2026-09-25T09:00:00.000Z", lastBackupAt: null },
    costs: {
      "gardegen-60": {
        variantId: "gardegen-60",
        costMinor: 120000,
        policy: { kind: "margin", rate: 0.4 },
      },
    },
    images: null,
  });

  it("geri okunur, özet doğru", () => {
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.ok && parsed.summary).toMatchObject({ variants: 14, costs: 1, orders: 0 });
  });

  it.each([
    ["{", "geçerli bir JSON değil"],
    ['{"app":"baska"}', "SNN Sipariş yedeği değil"],
    ['{"app":"snn-siparis","schema":9}', "sürümü tanınmadı"],
    ['{"app":"snn-siparis","schema":1}', "eksik ya da bozuk"],
  ])("reddedilir: %s", (raw, message) => {
    const parsed = parseBackup(raw);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.message).toContain(message);
  });

  it("maliyetli yedeğin dosya adı işaretli", () => {
    expect(backupFileName("2026-09-25", true)).toBe("snn-siparis-yedek_2026-09-25_MALIYETLI.json");
    expect(backupFileName("2026-09-25", false)).toBe("snn-siparis-yedek_2026-09-25.json");
  });
});
