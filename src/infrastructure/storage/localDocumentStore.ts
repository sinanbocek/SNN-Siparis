import type {
  DocumentStore,
  LoadResult,
  SaveResult,
  StoreError,
} from "../../application/ports/stores.ts";

/** window.localStorage'ın ihtiyaç duyulan yüzü; testte sahte depo verilebilir. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  readonly length: number;
  key(index: number): string | null;
}

export const KEY_PREFIX = "snn-siparis.";
const SCHEMA_VERSION = 1;

interface Envelope {
  readonly version: number;
  readonly data: unknown;
}

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

function writeError(error: unknown): StoreError {
  return isQuotaError(error) ? "quota" : "unavailable";
}

/**
 * Sürüm etiketli tek belge. `load` asla silmez; bozuk kayıt üzerine yazılmadan önce
 * ham metni `.corrupt-backup` anahtarına kopyalanır (ihale deseni, D4).
 */
export function createLocalDocumentStore<T>(
  storage: KeyValueStorage | null,
  name: string,
  guard: (value: unknown) => value is T,
): DocumentStore<T> {
  const key = `${KEY_PREFIX}${name}`;
  const backupKey = `${key}.corrupt-backup`;

  const read = (): LoadResult<T> => {
    if (storage === null) return { ok: false, reason: "unavailable" };
    let raw: string | null;
    try {
      raw = storage.getItem(key);
    } catch {
      return { ok: false, reason: "unavailable" };
    }
    if (raw === null) return { ok: true, value: null };
    try {
      const parsed = JSON.parse(raw) as Envelope;
      if (parsed.version !== SCHEMA_VERSION || !guard(parsed.data)) {
        return { ok: false, reason: "corrupt" };
      }
      return { ok: true, value: parsed.data };
    } catch {
      return { ok: false, reason: "corrupt" };
    }
  };

  const preserveCorrupt = (): boolean => {
    if (storage === null) return false;
    const current = read();
    if (current.ok || current.reason !== "corrupt") return true;
    try {
      const raw = storage.getItem(key);
      if (raw !== null) storage.setItem(backupKey, raw);
      return true;
    } catch {
      return false;
    }
  };

  return {
    load: read,
    save(value: T): SaveResult {
      if (storage === null) return { ok: false, reason: "unavailable" };
      if (!preserveCorrupt()) return { ok: false, reason: "unavailable" };
      try {
        const envelope: Envelope = { version: SCHEMA_VERSION, data: value };
        storage.setItem(key, JSON.stringify(envelope));
        return { ok: true };
      } catch (error) {
        return { ok: false, reason: writeError(error) };
      }
    },
    clear(): SaveResult {
      if (storage === null) return { ok: false, reason: "unavailable" };
      if (!preserveCorrupt()) return { ok: false, reason: "unavailable" };
      try {
        storage.removeItem(key);
        return { ok: true };
      } catch {
        return { ok: false, reason: "unavailable" };
      }
    },
    raw(): string | null {
      if (storage === null) return null;
      try {
        return storage.getItem(key);
      } catch {
        return null;
      }
    },
  };
}

/** Bu uygulamanın anahtarlarının toplam boyutu (UTF-16 → ×2 bayt). */
export function measureUsage(storage: KeyValueStorage | null): number | null {
  if (storage === null) return null;
  try {
    let total = 0;
    for (let i = 0; i < storage.length; i += 1) {
      const k = storage.key(i);
      if (k === null || !k.startsWith(KEY_PREFIX)) continue;
      const v = storage.getItem(k);
      total += (k.length + (v === null ? 0 : v.length)) * 2;
    }
    return total;
  } catch {
    return null;
  }
}

/** Depo gerçekten yazılabilir mi (gizli sekme, kapalı depo — D2)? */
export function probeStorage(candidate: KeyValueStorage | undefined): KeyValueStorage | null {
  if (candidate === undefined) return null;
  try {
    const probe = `${KEY_PREFIX}probe`;
    candidate.setItem(probe, "1");
    candidate.removeItem(probe);
    return candidate;
  } catch {
    return null;
  }
}
