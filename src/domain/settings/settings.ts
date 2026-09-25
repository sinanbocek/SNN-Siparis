import type { MinorAmount, Rate } from "../abacus/index.ts";

export interface Settings {
  readonly repName: string;
  /** Kodda yer tutucu; gerçek numara yalnız cihazda (ADR-0003). */
  readonly repPhone: string;
  readonly headerTitle: string;
  readonly vatRate: Rate;
  readonly roundingStepMinor: MinorAmount;
  readonly defaultPharmacistMarkup: Rate;
  readonly orderPrefix: string;
}

export const DEFAULT_SETTINGS: Settings = {
  repName: "Volkan ULU",
  repPhone: "05555555555",
  headerTitle: "Sipariş Formu",
  vatRate: 0.01,
  roundingStepMinor: 100,
  defaultPharmacistMarkup: 0.2,
  orderPrefix: "VU",
};

export const ROUNDING_STEPS: readonly MinorAmount[] = [1, 100, 500, 1000];
