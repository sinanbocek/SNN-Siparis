import { math, money, type MinorAmount, type Rate } from "../abacus/index.ts";

/** "1.116,67" · "₺1.116,67" · "1116" → kuruş; okunamazsa null (H6). */
export function parseMoneyInput(raw: string): MinorAmount | null {
  const cleaned = raw.replace(/₺|TL/gi, "").trim();
  if (cleaned.length === 0) return null;
  const value = money.parseNumber(cleaned);
  if (value === null) return null;
  return money.toMinor(value);
}

/** "20" · "20,5" · "%20" → 0.2 / 0.205; okunamazsa null (H6). */
export function parseRateInput(raw: string): Rate | null {
  const cleaned = raw.replace(/%/g, "").trim();
  if (cleaned.length === 0) return null;
  const value = money.parseNumber(cleaned);
  if (value === null) return null;
  return math.div(value, 100);
}

/** Adet kutusu: yalnız rakam; boş → 0. */
export function parseQtyInput(raw: string): number | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return 0;
  const value = Number(digits);
  return Number.isSafeInteger(value) ? value : null;
}

/** Oranı giriş kutusu metnine çevirir: 0.205 → "20,5". */
export function rateToInput(rate: Rate): string {
  const shown = money.decimal(math.round(math.mul(rate, 100), 2), 2);
  return shown.includes(",") ? shown.replace(/0+$/, "").replace(/,$/, "") : shown;
}
