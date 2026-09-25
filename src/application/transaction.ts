import type { SaveResult, StoreError } from "./ports/stores.ts";

/**
 * Birden çok kaydı "ya hep ya hiç" yazar (yedek yükleme). Bir adım başarısız olursa önce
 * yazılan adımlar eski değerlerine döndürülür; başarısız adımın nedeni döner.
 */
export interface WriteStep {
  readonly write: () => SaveResult;
  readonly rollback: () => void;
}

export function writeAllOrNothing(steps: readonly WriteStep[]): StoreError | null {
  const done: WriteStep[] = [];
  for (const step of steps) {
    const result = step.write();
    if (!result.ok) {
      for (const previous of [...done].reverse()) previous.rollback();
      return result.reason;
    }
    done.push(step);
  }
  return null;
}
