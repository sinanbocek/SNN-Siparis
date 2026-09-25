import { math, money, text, type MinorAmount, type Rate } from "../abacus/index.ts";

/**
 * Giriş kutuları — aile standardı `giris-alanlari-standardi.md`:
 * yanlış karakter hiç yazılamaz; biçim yazarken kurulur; kuruş girişte asla kısıtlanmaz.
 */

/** Adet ve MF kutusunun en çok hane sayısı (9.999). */
export const QTY_DIGITS = 4;

/** "1.116,67" · "₺1.116,67" · "1116" → kuruş; okunamazsa null (H6). */
export function parseMoneyInput(raw: string): MinorAmount | null {
  const cleaned = stripCurrency(raw);
  if (cleaned.length === 0) return null;
  const value = money.parseNumber(cleaned);
  if (value === null) return null;
  return money.toMinor(value);
}

function stripCurrency(raw: string): string {
  return raw.replace(/₺|TL|\s/gi, "");
}

/** Geçerli Türkçe tutar yazımı: 1.234.567 · 1.234,5 · 1234,56 */
const VALID_GROUPING = /^\d{1,3}(\.\d{3})*(,\d{0,2})?$|^\d+(,\d{0,2})?$/;

export interface MoneyInputResult {
  readonly text: string;
  /** Belirsiz girdi (ör. "98.5"): kutu değişmez, kullanıcıya "kuruş için virgül" denir. */
  readonly rejected: boolean;
}

/**
 * Para kutusunun canlı biçimi. Nokta her zaman binlik ayraçtır, kuruş virgülle yazılır.
 * `dotAsDecimal` kullanılmaz (standart: "₺1.234" yapıştırınca 1000 kat küçülür).
 * Kullanıcının kendi eklediği nokta geçerli binlik gruplamaya uymuyorsa (ör. "98.5")
 * sessizce 985 yapılmaz; girdi reddedilir.
 */
export function moneyInput(raw: string, previous: string): MoneyInputResult {
  const cleaned = stripCurrency(raw);
  if (cleaned.length > previous.length && insertedText(previous, cleaned).includes(".")) {
    if (!VALID_GROUPING.test(cleaned)) return { text: previous, rejected: true };
  }
  return { text: money.formatGroupedInput(cleaned, { maxDigits: 2 }), rejected: false };
}

/** Önceki metne göre araya giren parça (yazılan tuş ya da yapıştırılan metin). */
function insertedText(previous: string, next: string): string {
  let start = 0;
  while (start < previous.length && previous[start] === next[start]) start += 1;
  let endPrev = previous.length;
  let endNext = next.length;
  while (endPrev > start && endNext > start && previous[endPrev - 1] === next[endNext - 1]) {
    endPrev -= 1;
    endNext -= 1;
  }
  return next.slice(start, endNext);
}

/** "20" · "20,5" · "%20" → 0.2 / 0.205; okunamazsa null (H6). */
export function parseRateInput(raw: string): Rate | null {
  const cleaned = raw.replace(/%/g, "").trim();
  if (cleaned.length === 0) return null;
  const value = money.parseNumber(cleaned);
  if (value === null) return null;
  return math.div(value, 100);
}

/** Oran kutusunun canlı süzmesi: rakam ve tek virgül, en çok 2 ondalık. */
export function rateInput(raw: string): string {
  return money.formatGroupedInput(raw.replace(/%/g, ""), { maxDigits: 2 });
}

/** Adet kutusunun canlı süzmesi: yalnız rakam, en çok 4 hane (ABACUS text.digits). */
export function qtyInput(raw: string): string {
  return text.digits(raw, QTY_DIGITS);
}

/** Adet kutusu: yalnız rakam; boş → 0. */
export function parseQtyInput(raw: string): number | null {
  const digits = text.digits(raw);
  if (digits.length === 0) return 0;
  const value = Number(digits);
  return Number.isSafeInteger(value) ? value : null;
}

/** Oranı giriş kutusu metnine çevirir: 0.205 → "20,5". */
export function rateToInput(rate: Rate): string {
  const shown = money.decimal(math.round(math.mul(rate, 100), 2), 2);
  return shown.includes(",") ? shown.replace(/0+$/, "").replace(/,$/, "") : shown;
}
