import { describe, expect, it } from "vitest";
import { fmtMoney, fmtStamp } from "./format.ts";

describe("sunum biçimleri (ABACUS)", () => {
  it("para her yerde ₺ ve kuruşlu", () => {
    expect(fmtMoney(2964627829)).toBe("₺29.646.278,29");
    expect(fmtMoney(null)).toBe("—");
  });

  it.each([
    ["2026-09-25T17:09:00.000Z", "2026-09-25T18:00:00.000Z", "25 Eyl. 20:09"],
    ["2025-12-24T09:00:00.000Z", "2026-09-25T18:00:00.000Z", "24 Ara. 2025"],
  ])("damga %s → %s", (iso, now, shown) => {
    expect(fmtStamp(iso, now)).toBe(shown);
  });
});
