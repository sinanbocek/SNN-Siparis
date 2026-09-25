/**
 * ABACUS kapısı (ADR-0001): tüm hesap ve biçim `@snn/abacus-core` üzerinden geçer.
 * İç katmanlar çekirdeği buradan alır; ham `Math.*`, `Intl`, `toFixed` lint ile yasaktır.
 */
export { math, money, text, date, period, collate } from "@snn/abacus-core";

/** Kuruş cinsinden tam sayı tutar. */
export type MinorAmount = number;

/** Oran kesir olarak tutulur: %20 → 0.2. */
export type Rate = number;
