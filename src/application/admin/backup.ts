import type { Catalog } from "../../domain/catalog/catalog.ts";
import type { CostBook, CostEntry, ProfitPolicy } from "../../domain/costs/costs.ts";
import type { Order } from "../../domain/order/order.ts";
import type { Settings } from "../../domain/settings/settings.ts";
import type { ImageMap, Meta } from "../ports/stores.ts";
import {
  isCatalog,
  isImageMap,
  isInt,
  isMeta,
  isNumber,
  isObject,
  isOrders,
  isSettings,
  isString,
  nullable,
} from "../validation.ts";

/** Cihazlar arası tek köprü: JSON yedek (F, D6). */
export const BACKUP_APP = "snn-siparis";
export const BACKUP_SCHEMA = 1;

export interface BackupFile {
  readonly app: typeof BACKUP_APP;
  readonly schema: typeof BACKUP_SCHEMA;
  readonly exportedAt: string;
  readonly settings: Settings;
  readonly catalog: Catalog;
  readonly orders: readonly Order[];
  readonly meta: Meta;
  /** "Maliyetler dahil" seçilirse (G5). */
  readonly costs: CostBook | null;
  /** Kullanıcının yüklediği görseller; seçime bağlı. */
  readonly images: ImageMap | null;
}

export interface BackupSummary {
  readonly families: number;
  readonly variants: number;
  readonly costs: number;
  readonly orders: number;
  readonly images: number;
  readonly exportedAt: string;
}

export function buildBackup(input: Omit<BackupFile, "app" | "schema">): BackupFile {
  return { app: BACKUP_APP, schema: BACKUP_SCHEMA, ...input };
}

export function backupFileName(day: string, withCosts: boolean): string {
  return `snn-siparis-yedek_${day}${withCosts ? "_MALIYETLI" : ""}.json`;
}

const isPolicy = (v: unknown): v is ProfitPolicy =>
  isObject(v) &&
  (((v.kind === "markup" || v.kind === "margin") && isNumber(v.rate)) ||
    (v.kind === "fixed_price" && isInt(v.priceMinor)) ||
    (v.kind === "target_profit" && isInt(v.profitMinor)));

const isCostEntry = (v: unknown): v is CostEntry =>
  isObject(v) && isString(v.variantId) && nullable(isInt)(v.costMinor) && isPolicy(v.policy);

export const isCostBook = (v: unknown): v is CostBook =>
  isObject(v) && Object.values(v).every(isCostEntry);

export type ParsedBackup =
  | { readonly ok: true; readonly backup: BackupFile; readonly summary: BackupSummary }
  | { readonly ok: false; readonly message: string };

/** Yedek dosyasını doğrular; hatada mevcut veri aynen kalır (D6). */
export function parseBackup(raw: string): ParsedBackup {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, message: "Dosya okunamadı: geçerli bir JSON değil." };
  }
  if (!isObject(data) || data.app !== BACKUP_APP) {
    return { ok: false, message: "Bu dosya bir SNN Sipariş yedeği değil." };
  }
  if (data.schema !== BACKUP_SCHEMA) {
    return { ok: false, message: `Yedek sürümü tanınmadı (${String(data.schema)}).` };
  }
  if (
    !isString(data.exportedAt) ||
    !isSettings(data.settings) ||
    !isCatalog(data.catalog) ||
    !isOrders(data.orders) ||
    !isMeta(data.meta) ||
    !nullable(isCostBook)(data.costs) ||
    !nullable(isImageMap)(data.images)
  ) {
    return { ok: false, message: "Yedek dosyası eksik ya da bozuk." };
  }
  const backup = data as unknown as BackupFile;
  return {
    ok: true,
    backup,
    summary: {
      families: backup.catalog.families.length,
      variants: backup.catalog.variants.length,
      costs: backup.costs
        ? Object.values(backup.costs).filter((c) => c.costMinor !== null).length
        : 0,
      orders: backup.orders.length,
      images: backup.images ? Object.keys(backup.images).length : 0,
      exportedAt: backup.exportedAt,
    },
  };
}
