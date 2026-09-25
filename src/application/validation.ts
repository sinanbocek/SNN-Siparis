import type { Cart, CartLine, PharmacyDraft } from "../domain/cart/cart.ts";
import type { Catalog, Family, MfRule, PsfSetting, Variant } from "../domain/catalog/catalog.ts";
import type { Order, OrderLine } from "../domain/order/order.ts";
import type { Settings } from "../domain/settings/settings.ts";
import type { ImageMap, Meta } from "./ports/stores.ts";

/**
 * Cihazdan ya da yedek dosyasından okunan veriyi şekil olarak doğrular (D4, D6).
 * Tanınmayan kayıt "bozuk" sayılır; sessizce düzeltilmez.
 */
type Guard<T> = (value: unknown) => value is T;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === "string";
const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v);
const isBool = (v: unknown): v is boolean => typeof v === "boolean";
const nullable =
  <T>(guard: Guard<T>): Guard<T | null> =>
  (v): v is T | null =>
    v === null || guard(v);
const arrayOf =
  <T>(guard: Guard<T>): Guard<readonly T[]> =>
  (v): v is readonly T[] =>
    Array.isArray(v) && v.every(guard);

export const isSettings: Guard<Settings> = (v): v is Settings =>
  isObject(v) &&
  isString(v.repName) &&
  isString(v.repPhone) &&
  isString(v.headerTitle) &&
  isNumber(v.vatRate) &&
  isInt(v.roundingStepMinor) &&
  v.roundingStepMinor > 0 &&
  isNumber(v.defaultPharmacistMarkup) &&
  isString(v.orderPrefix);

const isFamily: Guard<Family> = (v): v is Family =>
  isObject(v) &&
  isString(v.id) &&
  isString(v.name) &&
  isString(v.color) &&
  nullable(isString)(v.accent) &&
  isNumber(v.order) &&
  isBool(v.active);

const isPsf: Guard<PsfSetting> = (v): v is PsfSetting =>
  isObject(v) && (v.mode === "computed" || (v.mode === "fixed" && isInt(v.priceMinor)));

const isMfRule: Guard<MfRule> = (v): v is MfRule =>
  isObject(v) && isInt(v.every) && isInt(v.free) && v.every > 0 && v.free > 0;

const isVariant: Guard<Variant> = (v): v is Variant =>
  isObject(v) &&
  isString(v.id) &&
  isString(v.familyId) &&
  isString(v.name) &&
  isString(v.unit) &&
  nullable(isInt)(v.saleMinor) &&
  isPsf(v.psf) &&
  nullable(isNumber)(v.pharmacistMarkup) &&
  nullable(isNumber)(v.vatRate) &&
  nullable(isMfRule)(v.mfRule) &&
  isNumber(v.order) &&
  isBool(v.active);

export const isCatalog: Guard<Catalog> = (v): v is Catalog =>
  isObject(v) && arrayOf(isFamily)(v.families) && arrayOf(isVariant)(v.variants);

export const isImageMap: Guard<ImageMap> = (v): v is ImageMap =>
  isObject(v) && Object.values(v).every(isString);

const isPharmacy: Guard<PharmacyDraft> = (v): v is PharmacyDraft =>
  isObject(v) &&
  isString(v.name) &&
  isString(v.district) &&
  isString(v.address) &&
  isString(v.phone);

const isCartLine: Guard<CartLine> = (v): v is CartLine =>
  isObject(v) &&
  isString(v.variantId) &&
  isInt(v.qty) &&
  nullable(isInt)(v.mfOverride) &&
  nullable(isNumber)(v.markupOverride) &&
  isInt(v.unitAtAdd);

export const isCart: Guard<Cart> = (v): v is Cart =>
  isObject(v) &&
  arrayOf(isCartLine)(v.lines) &&
  nullable(isNumber)(v.markupOverride) &&
  isPharmacy(v.pharmacy) &&
  isString(v.note);

const isOrderLine: Guard<OrderLine> = (v): v is OrderLine =>
  isObject(v) &&
  isString(v.variantId) &&
  isString(v.label) &&
  isInt(v.qty) &&
  isInt(v.mf) &&
  isInt(v.unitMinor) &&
  isInt(v.amountMinor) &&
  isNumber(v.vatRate);

const isVatGroup = (v: unknown) =>
  isObject(v) && isNumber(v.rate) && isInt(v.baseMinor) && isInt(v.vatMinor);

const isOrder: Guard<Order> = (v): v is Order =>
  isObject(v) &&
  isString(v.no) &&
  isString(v.createdAt) &&
  isString(v.day) &&
  isPharmacy(v.pharmacy) &&
  isString(v.note) &&
  isString(v.repName) &&
  isString(v.repPhone) &&
  isString(v.headerTitle) &&
  arrayOf(isOrderLine)(v.lines) &&
  isInt(v.netMinor) &&
  Array.isArray(v.vatGroups) &&
  v.vatGroups.every(isVatGroup) &&
  isInt(v.grossMinor) &&
  (v.status === "ready" || v.status === "shared") &&
  isInt(v.shareCount);

export const isOrders: Guard<readonly Order[]> = arrayOf(isOrder);

export const isMeta: Guard<Meta> = (v): v is Meta =>
  isObject(v) && isString(v.installedAt) && nullable(isString)(v.lastBackupAt);

export { isObject, isString, isInt, isNumber, nullable, arrayOf, type Guard };
