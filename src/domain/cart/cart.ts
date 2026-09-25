import { math, type MinorAmount, type Rate } from "../abacus/index.ts";
import {
  effectiveVat,
  findVariant,
  variantLabel,
  variantPsf,
  type Catalog,
  type MfRule,
  type Variant,
} from "../catalog/catalog.ts";
import { psfFromSale, vatOnMinor } from "../pricing/pricing.ts";
import type { Settings } from "../settings/settings.ts";

/** Adet sınırı (H1): yalnız 1–9.999 tam sayı; 0 satırı kaldırır. */
export const MAX_QTY = 9999;

export interface PharmacyDraft {
  readonly name: string;
  readonly district: string;
  readonly address: string;
  readonly phone: string;
}

export const EMPTY_PHARMACY: PharmacyDraft = { name: "", district: "", address: "", phone: "" };

export interface CartLine {
  readonly variantId: string;
  readonly qty: number;
  /** Pazarlıkta elle MF (S2); null = kural. */
  readonly mfOverride: number | null;
  /** Satıra özel eczacı oranı; null = sepet/katalog. */
  readonly markupOverride: Rate | null;
  /** Satıra eklendiği andaki birim fiyat; değişirse "fiyat güncellendi" rozeti (D8). */
  readonly unitAtAdd: MinorAmount;
}

export interface Cart {
  readonly lines: readonly CartLine[];
  /** Yalnız bu sipariş için eczacı oranı (H9); ayarlara yazılmaz. */
  readonly markupOverride: Rate | null;
  readonly pharmacy: PharmacyDraft;
  readonly note: string;
}

export const EMPTY_CART: Cart = {
  lines: [],
  markupOverride: null,
  pharmacy: EMPTY_PHARMACY,
  note: "",
};

export function isValidQty(qty: number): boolean {
  return Number.isSafeInteger(qty) && qty >= 0 && qty <= MAX_QTY;
}

/** MF kuralı katlanarak uygulanır: 25 kutu, "10 alana 1" → 2 MF (S1). */
export function mfFromRule(qty: number, rule: MfRule | null): number {
  if (rule === null || rule.every <= 0 || rule.free <= 0 || qty <= 0) return 0;
  const units = math.div(qty, rule.every);
  return units === null ? 0 : math.mul(math.floor(units), rule.free);
}

/** Adeti ayarlar; 0 satırı kaldırır, geçersiz adet sepeti değiştirmez. */
export function setQty(cart: Cart, variant: Variant, qty: number): Cart {
  if (!isValidQty(qty) || variant.saleMinor === null) return cart;
  const existing = cart.lines.find((l) => l.variantId === variant.id);
  if (qty === 0) return { ...cart, lines: cart.lines.filter((l) => l.variantId !== variant.id) };
  if (existing) {
    return {
      ...cart,
      lines: cart.lines.map((l) => (l.variantId === variant.id ? { ...l, qty } : l)),
    };
  }
  const line: CartLine = {
    variantId: variant.id,
    qty,
    mfOverride: null,
    markupOverride: null,
    unitAtAdd: variant.saleMinor,
  };
  return { ...cart, lines: [...cart.lines, line] };
}

export function updateLine(cart: Cart, variantId: string, patch: Partial<CartLine>): Cart {
  return {
    ...cart,
    lines: cart.lines.map((l) => (l.variantId === variantId ? { ...l, ...patch } : l)),
  };
}

export function qtyOf(cart: Cart, variantId: string): number {
  const line = cart.lines.find((l) => l.variantId === variantId);
  return line ? line.qty : 0;
}

export interface LineSummary {
  readonly variantId: string;
  readonly label: string;
  readonly qty: number;
  readonly mf: number;
  readonly mfFromRule: number;
  readonly unitMinor: MinorAmount;
  readonly amountMinor: MinorAmount;
  readonly psfMinor: MinorAmount;
  readonly vatRate: Rate;
  readonly markupOverride: Rate | null;
  readonly priceChanged: boolean;
}

export interface VatGroup {
  readonly rate: Rate;
  readonly baseMinor: MinorAmount;
  readonly vatMinor: MinorAmount;
}

export interface CartSummary {
  readonly lines: readonly LineSummary[];
  /** Satırı düşen ürünler (silindi, gizlendi, fiyatsız) — D7. */
  readonly droppedVariantIds: readonly string[];
  readonly qtyTotal: number;
  readonly mfTotal: number;
  readonly netMinor: MinorAmount;
  readonly vatGroups: readonly VatGroup[];
  readonly grossMinor: MinorAmount;
  /** Σ adet × PSF (KDV hariç). MF kazanca eklenmez (M2). */
  readonly shelfRevenueMinor: MinorAmount;
  readonly pharmacistProfitMinor: MinorAmount;
  /** Kazanç ÷ toplam; toplam 0 ise null. */
  readonly pharmacistRate: Rate | null;
  /** MF kutuların raf değeri — yalnız bilgi (S4). */
  readonly mfShelfValueMinor: MinorAmount;
  /** Σ adet × PSF × (1 + KDV) — tüketicinin rafta gördüğü toplam. */
  readonly shelfGrossMinor: MinorAmount;
  /** Sepette etkin eczacı oranı (sepet değişikliği ya da ayar). */
  readonly markupInEffect: Rate;
}

function linePsf(
  variant: Variant,
  saleMinor: MinorAmount,
  line: CartLine,
  cart: Cart,
  settings: Settings,
): MinorAmount | null {
  const override = line.markupOverride ?? cart.markupOverride;
  if (override !== null) return psfFromSale(saleMinor, override, settings.roundingStepMinor);
  return variantPsf(variant, settings);
}

/** Sepetin tüm hesabı. Satır tutarı tam sayı × tam sayı; KDV oran grubunda bir kez (H7, H8). */
export function summarizeCart(catalog: Catalog, settings: Settings, cart: Cart): CartSummary {
  const lines: LineSummary[] = [];
  const dropped: string[] = [];
  for (const line of cart.lines) {
    const variant = findVariant(catalog, line.variantId);
    if (!variant || !variant.active || variant.saleMinor === null || line.qty <= 0) {
      dropped.push(line.variantId);
      continue;
    }
    const psf = linePsf(variant, variant.saleMinor, line, cart, settings);
    if (psf === null) {
      dropped.push(line.variantId);
      continue;
    }
    const ruleMf = mfFromRule(line.qty, variant.mfRule);
    lines.push({
      variantId: variant.id,
      label: variantLabel(catalog, variant),
      qty: line.qty,
      mf: line.mfOverride ?? ruleMf,
      mfFromRule: ruleMf,
      unitMinor: variant.saleMinor,
      amountMinor: math.mul(line.qty, variant.saleMinor),
      psfMinor: psf,
      vatRate: effectiveVat(variant, settings),
      markupOverride: line.markupOverride,
      priceChanged: line.unitAtAdd !== variant.saleMinor,
    });
  }

  const sum = (values: readonly number[]) => values.reduce((acc, v) => math.add(acc, v), 0);
  const netMinor = sum(lines.map((l) => l.amountMinor));

  const rates = [...new Set(lines.map((l) => l.vatRate))].sort((a, b) => a - b);
  const vatGroups = rates.map((rate) => {
    const baseMinor = sum(lines.filter((l) => l.vatRate === rate).map((l) => l.amountMinor));
    return { rate, baseMinor, vatMinor: vatOnMinor(baseMinor, rate) };
  });
  const grossMinor = math.add(netMinor, sum(vatGroups.map((g) => g.vatMinor)));

  const shelfRevenueMinor = sum(lines.map((l) => math.mul(l.qty, l.psfMinor)));
  const pharmacistProfitMinor = math.sub(shelfRevenueMinor, netMinor);
  const shelfGrossMinor = sum(
    lines.map((l) => {
      const net = math.mul(l.qty, l.psfMinor);
      return math.add(net, vatOnMinor(net, l.vatRate));
    }),
  );

  return {
    lines,
    droppedVariantIds: dropped,
    qtyTotal: sum(lines.map((l) => l.qty)),
    mfTotal: sum(lines.map((l) => l.mf)),
    netMinor,
    vatGroups,
    grossMinor,
    shelfRevenueMinor,
    pharmacistProfitMinor,
    pharmacistRate: netMinor > 0 ? math.div(pharmacistProfitMinor, netMinor) : null,
    mfShelfValueMinor: sum(lines.map((l) => math.mul(l.mf, l.psfMinor))),
    shelfGrossMinor,
    markupInEffect: cart.markupOverride ?? settings.defaultPharmacistMarkup,
  };
}

/** Düşen satırları sepetten atar (D7). */
export function pruneCart(cart: Cart, droppedVariantIds: readonly string[]): Cart {
  if (droppedVariantIds.length === 0) return cart;
  return { ...cart, lines: cart.lines.filter((l) => !droppedVariantIds.includes(l.variantId)) };
}
