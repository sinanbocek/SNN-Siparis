import { date, math, money } from "@snn/abacus-core";
import type { MinorAmount, Rate } from "../../domain/abacus/index.ts";

/** Sunumdaki tüm biçimler ABACUS'tan; elle biçim yasak (CI grep kapısı). */

/** Tablo hücresi: 2.000,00 (simgesiz). */
export function fmtAmount(minor: MinorAmount | null): string {
  if (minor === null) return "—";
  return money.formatMinorInput(minor, 2);
}

/** Toplamlar: ₺2.000,00. Girdi kuruş; ABACUS kuruş kapısı bilinçli geçilir. */
export function fmtMoney(minor: MinorAmount | null): string {
  if (minor === null) return "—";
  // eslint-disable-next-line no-restricted-properties -- girdi kuruş (MinorAmount)
  return money.format(minor, { kurus: true });
}

/** Büyük rakam: 29.900 TL (kuruş sıfırsa gösterilmez). */
export function fmtMoneyText(minor: MinorAmount | null): string {
  if (minor === null) return "—";
  const whole = math.mod(minor, 100) === 0;
  // eslint-disable-next-line no-restricted-properties -- girdi kuruş (MinorAmount)
  return money.format(minor, { kurus: !whole, form: "text" });
}

/** Oran: 0.2 → %20; 0.3605 → %36,1. */
export function fmtRate(rate: Rate | null, digits = 1): string {
  if (rate === null) return "—";
  return money.percent(math.mul(rate, 100), digits);
}

export function fmtDate(iso: string): string {
  return date.format(iso);
}

export function fmtDateTime(iso: string): string {
  return date.format(iso, "dateTime");
}

export function amountInWords(minor: MinorAmount): string {
  return money.toWords(minor);
}

/** Bayt: 1,2 MB. */
export function fmtBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  const mb = math.div(bytes, 1048576);
  if (mb === null) return "—";
  return `${money.decimal(math.round(mb, 2), 2)} MB`;
}

/** Giriş kutusu: kuruş → "2.000" veya "1.116,67". */
export function moneyToInput(minor: MinorAmount | null): string {
  if (minor === null) return "";
  const shown = money.formatMinorInput(minor, 2);
  return shown.endsWith(",00") ? shown.slice(0, -3) : shown;
}

/** Kutu yazılırken canlı binlik ayraç. */
export function liveMoneyInput(raw: string, previous: string): string {
  return money.formatGroupedInput(raw, { dotAsDecimal: true, previous, maxDigits: 2 });
}
