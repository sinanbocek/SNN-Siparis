import type { CostBook } from "../../domain/costs/costs.ts";
import type { DocumentStore } from "../ports/stores.ts";

/** Maliyet deposu — yalnız yönetim tarafına verilir (ADR-0002). */
export type CostStore = DocumentStore<CostBook>;

/** Geçici yönetim şifresi (MVP perdesi, G1). Gerçek güvenlik MVP sonrası. */
export const ADMIN_PASSWORD = "0";

/** İşlemsizlikte otomatik kilit süresi. */
export const ADMIN_IDLE_MS = 5 * 60 * 1000;

/** Son yedek bundan eskiyse uyarı (D5). */
export const BACKUP_STALE_DAYS = 7;
