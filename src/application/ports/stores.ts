import type { Cart } from "../../domain/cart/cart.ts";
import type { Catalog } from "../../domain/catalog/catalog.ts";
import type { Order } from "../../domain/order/order.ts";
import type { Settings } from "../../domain/settings/settings.ts";

/**
 * Cihaz depolama portu (ihale `companyProfileStore` deseni).
 * - unavailable: depo kapalı / gizli sekme (D2)
 * - corrupt: kayıt okunamadı veya şema tanınmadı (D4)
 * - quota: yer kalmadı (D3)
 */
export type StoreError = "unavailable" | "corrupt" | "quota";

export type LoadResult<T> =
  | { readonly ok: true; readonly value: T | null }
  | { readonly ok: false; readonly reason: StoreError };

export type SaveResult =
  { readonly ok: true } | { readonly ok: false; readonly reason: StoreError };

export interface DocumentStore<T> {
  load(): LoadResult<T>;
  save(value: T): SaveResult;
  clear(): SaveResult;
  /** Bozuk kaydın ham metni (indirilebilsin diye); yoksa null. */
  raw(): string | null;
}

/** Görsel eşlemesi: "family:<id>" / "variant:<id>" → data URL veya /products yolu. */
export type ImageMap = Readonly<Record<string, string>>;

export interface Meta {
  readonly installedAt: string;
  /** Son yedek alma zamanı (ISO); hiç alınmadıysa null (D5). */
  readonly lastBackupAt: string | null;
  /** Bu cihazda verilmiş son sipariş numarası (silinse de yeniden verilmez). Eski kayıtlarda yok. */
  readonly lastOrderNo?: string;
}

export interface SalesStores {
  readonly settings: DocumentStore<Settings>;
  readonly catalog: DocumentStore<Catalog>;
  readonly images: DocumentStore<ImageMap>;
  readonly cart: DocumentStore<Cart>;
  readonly orders: DocumentStore<readonly Order[]>;
  readonly meta: DocumentStore<Meta>;
  /** Depo kullanımını bayt olarak ölçer; ölçülemezse null. */
  usageBytes(): number | null;
}
