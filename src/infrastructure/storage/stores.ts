import { isCostBook } from "../../application/admin/backup.ts";
import type { CostStore } from "../../application/admin/ports.ts";
import type { SalesStores } from "../../application/ports/stores.ts";
import {
  isCart,
  isCatalog,
  isImageMap,
  isMeta,
  isOrders,
  isSettings,
} from "../../application/validation.ts";
import {
  createLocalDocumentStore,
  measureUsage,
  type KeyValueStorage,
} from "./localDocumentStore.ts";

/** localStorage anahtarları: snn-siparis.<ad> (PRD §8.1). */
export function createSalesStores(storage: KeyValueStorage | null): SalesStores {
  return {
    settings: createLocalDocumentStore(storage, "settings", isSettings),
    catalog: createLocalDocumentStore(storage, "catalog", isCatalog),
    images: createLocalDocumentStore(storage, "images", isImageMap),
    cart: createLocalDocumentStore(storage, "cart", isCart),
    orders: createLocalDocumentStore(storage, "orders", isOrders),
    meta: createLocalDocumentStore(storage, "meta", isMeta),
    usageBytes: () => measureUsage(storage),
  };
}

export function createCostStore(storage: KeyValueStorage | null): CostStore {
  return createLocalDocumentStore(storage, "costs", isCostBook);
}
