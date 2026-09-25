import { describe, expect, it, vi } from "vitest";
import { writeAllOrNothing } from "./transaction.ts";

describe("ya hep ya hiç yazma (yedek yükleme)", () => {
  it("hepsi başarılıysa geri alma yok", () => {
    const rollback = vi.fn();
    const steps = [1, 2, 3].map(() => ({ write: () => ({ ok: true }) as const, rollback }));
    expect(writeAllOrNothing(steps)).toBeNull();
    expect(rollback).not.toHaveBeenCalled();
  });

  it("üçüncü adım yer yetmeyince ilk ikisi tersten geri alınır, sonuncusu dokunulmaz", () => {
    const order: string[] = [];
    const ok = (name: string) => ({
      write: () => ({ ok: true }) as const,
      rollback: () => order.push(name),
    });
    const failing = {
      write: () => ({ ok: false, reason: "quota" }) as const,
      rollback: () => order.push("fail"),
    };
    expect(writeAllOrNothing([ok("settings"), ok("catalog"), failing, ok("images")])).toBe("quota");
    expect(order).toEqual(["catalog", "settings"]);
  });
});
