import { math, money, text, type MinorAmount, type Rate } from "../abacus/index.ts";

/**
 * Giriş kutuları — aile standardı `giris-alanlari-standardi.md` ve GHS-Panel
 * `src/utils/moneyInput.ts` (referans uygulama, 2026-09-24): yanlış karakter hiç yazılamaz;
 * biçim yazarken kurulur; kuruş girişte asla kısıtlanmaz.
 */

/** Adet ve MF kutusunun en çok hane sayısı (9.999). */
export const QTY_DIGITS = 4;

/** Türkiye telefonu en çok 11 hane (0 5xx xxx xx xx). */
export const PHONE_DIGITS = 11;

export const MONEY_INPUT_MESSAGES = {
  invalidChar: "Yalnız rakam ve virgül yazılabilir.",
  useComma: "Kuruş için virgül (,) kullanın; binlik ayracı kendiliğinden konur.",
  oneComma: "Tek virgül olabilir.",
} as const;

export type MoneyInputStep =
  { readonly ok: true; readonly text: string } | { readonly ok: false; readonly message: string };

/** Para simgesi, "TL", "%" ve boşluklar kutu metnine ait değildir; yapıştırmada atılır. */
function stripDecorations(raw: string): string {
  return raw.replace(/₺|TL|%|\s/gi, "");
}

/** `previous` metnine tek karakter eklenerek `raw` oluştuysa o karakter. */
function singleInsertion(previous: string, raw: string): string | null {
  if (raw.length !== previous.length + 1) return null;
  for (let i = 0; i < raw.length; i += 1) {
    if (raw.slice(0, i) + raw.slice(i + 1) === previous) {
      const ch = raw[i];
      return ch === undefined ? null : ch;
    }
  }
  return null;
}

function format(clean: string): MoneyInputStep {
  return { ok: true, text: money.formatGroupedInput(clean, { maxDigits: 2 }) };
}

/**
 * Tutar/oran kutusunun bir sonraki durumu (GHS-Panel `moneyInputStep` ile aynı kural):
 * - yalnız rakam + tek virgül + en çok 2 ondalık; harf ve eksi reddedilir (sessizce silinmez)
 * - nokta binlik ayracıdır ve kendiliğinden konur; nokta tuşu reddedilir ("kuruş için virgül")
 * - yapıştırılan `₺1.234` / `85.340,50` aynı değer; belirsiz `98.5` reddedilir
 * Reddedilince kutu `previous`te kalır ve mesaj gösterilir.
 */
export function moneyInputStep(previous: string, raw: string): MoneyInputStep {
  const input = stripDecorations(raw);
  if (input === "") return { ok: true, text: "" };
  if (/[^0-9.,]/.test(input)) return { ok: false, message: MONEY_INPUT_MESSAGES.invalidChar };
  if (input.split(",").length > 2) return { ok: false, message: MONEY_INPUT_MESSAGES.oneComma };

  const inserted = singleInsertion(previous, raw);
  if (inserted === ".") return { ok: false, message: MONEY_INPUT_MESSAGES.useComma };

  const hasComma = input.includes(",");
  const hasDot = input.includes(".");
  // Tek tuş ya da silme: kutudaki noktalar bizim binlik ayracımızdır.
  if (inserted !== null || raw.length < previous.length || !hasDot || hasComma) {
    return format(input.replace(/\./g, ""));
  }
  // Yapıştırma, virgülsüz ve noktalı: yalnız düzgün binlik gruplaması kabul edilir.
  if (/^\d{1,3}(\.\d{3})+$/.test(input)) return format(input.replace(/\./g, ""));
  return { ok: false, message: MONEY_INPUT_MESSAGES.useComma };
}

/** "1.116,67" · "₺1.116,67" · "1116" → kuruş; okunamazsa null (H6). */
export function parseMoneyInput(raw: string): MinorAmount | null {
  const cleaned = stripDecorations(raw).replace(/,$/, "");
  if (cleaned.length === 0) return null;
  const value = money.parseNumber(cleaned);
  if (value === null) return null;
  return money.toMinor(value);
}

/** "20" · "20,5" · "%20" → 0.2 / 0.205; okunamazsa null (H6). */
export function parseRateInput(raw: string): Rate | null {
  const cleaned = stripDecorations(raw).replace(/,$/, "");
  if (cleaned.length === 0) return null;
  const value = money.parseNumber(cleaned);
  if (value === null) return null;
  return math.div(value, 100);
}

/** Adet kutusunun canlı süzmesi: yalnız rakam, en çok 4 hane (ABACUS text.digits). */
export function qtyInput(raw: string): string {
  return text.digits(raw, QTY_DIGITS);
}

/** Telefon kutusu: yalnız rakam, en çok 11 hane (ABACUS text.digits). */
export function phoneInput(raw: string): string {
  return text.digits(raw, PHONE_DIGITS);
}

/** Kayıtlı telefonu gösterir: geçerliyse "+90 (532) 123 45 67", değilse olduğu gibi. */
export function phoneDisplay(raw: string): string {
  if (raw.trim().length === 0) return "";
  const result = text.phone(raw);
  return result.valid ? result.display : raw;
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
