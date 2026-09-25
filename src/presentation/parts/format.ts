import { date, math, money } from "@snn/abacus-core";
import type { MinorAmount, Rate } from "../../domain/abacus/index.ts";

/**
 * Sunumdaki tüm biçimler ABACUS'tan; elle biçim yasak (CI grep kapısı).
 * Para her yerde tek biçimde: ₺29.646.278,29 (proje sahibi 25.09.2026).
 */

export const DASH = "—";

/** Kuruş → ₺2.000,00. ABACUS kuruş kapısı bilinçli geçilir (girdi MinorAmount). */
export function fmtMoney(minor: MinorAmount | null): string {
  if (minor === null) return DASH;
  // eslint-disable-next-line no-restricted-properties -- girdi kuruş (MinorAmount)
  return money.format(minor, { kurus: true });
}

/** Oran: 0.2 → %20; 0.3605 → %36,1. */
export function fmtRate(rate: Rate | null, digits = 1): string {
  if (rate === null) return DASH;
  return money.percent(math.mul(rate, 100), digits);
}

function yearOf(iso: string): string {
  return date.format(iso, "period").slice(3);
}

/**
 * Tarih-saat damgası (ABACUS parçalarıyla):
 * aynı yıl → "25 Eyl. 20:09"; farklı yıl → "24 Ara. 2025".
 */
export function fmtStamp(iso: string, nowIso: string): string {
  const day = date.format(iso, "dayMonth");
  if (yearOf(iso) !== yearOf(nowIso)) return `${day} ${yearOf(iso)}`;
  return `${day} ${date.format(iso, "time")}`;
}

export function amountInWords(minor: MinorAmount): string {
  return money.toWords(minor);
}

/** Bayt: 1,2 MB. */
export function fmtBytes(bytes: number | null): string {
  if (bytes === null) return DASH;
  const mb = math.div(bytes, 1048576);
  if (mb === null) return DASH;
  return `${money.decimal(math.round(mb, 2), 2)} MB`;
}

/** Giriş kutusu: kuruş → "2.000" veya "1.116,67". */
export function moneyToInput(minor: MinorAmount | null): string {
  if (minor === null) return "";
  const shown = money.formatMinorInput(minor, 2);
  return shown.endsWith(",00") ? shown.slice(0, -3) : shown;
}
