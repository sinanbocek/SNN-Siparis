/** @vitest-environment jsdom */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ShareService } from "../../application/ports/devices.ts";
import { SEED_CATALOG, SEED_IMAGES } from "../../composition/seed/seed.ts";
import { createCostStore, createSalesStores } from "../../infrastructure/storage/stores.ts";
import { DEFAULT_SETTINGS } from "../../domain/settings/settings.ts";
import { App } from "./App.tsx";

class MemoryStorage {
  data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

function setup(mem = new MemoryStorage()) {
  const share: ShareService = {
    canShareFiles: () => true,
    sharePng: vi.fn(async () => ({ kind: "shared" as const })),
    download: vi.fn(),
    copyImage: vi.fn(async () => true),
    openWhatsAppWeb: vi.fn(),
  };
  render(
    <App
      stores={createSalesStores(mem)}
      seed={{ catalog: SEED_CATALOG, settings: DEFAULT_SETTINGS, images: SEED_IMAGES }}
      share={share}
      png={{ render: async () => new Blob(["png"], { type: "image/png" }) }}
      resizer={{ resize: async () => "data:image/webp;base64,AA" }}
      updates={{ subscribe: () => () => undefined, apply: () => undefined }}
      now={() => "2026-09-25T10:00:00.000Z"}
      admin={{ costStore: createCostStore(mem) }}
    />,
  );
  return { mem, share };
}

afterEach(cleanup);

describe("saha akışı (C + D)", () => {
  it("katalogdan adet → sepette eczacı kazancı → paylaş → geçmiş", async () => {
    const { mem, share } = setup();
    fireEvent.click(screen.getAllByRole("button", { name: "Gardegen 60 Kapsül artır" })[0]!);
    const qty = screen.getByRole("textbox", { name: "Gardegen 60 Kapsül adet" });
    fireEvent.change(qty, { target: { value: "10" } });
    fireEvent.blur(qty);

    fireEvent.click(screen.getAllByRole("button", { name: /^Sepet/ })[0]!);
    const panel = screen.getByRole("complementary", { name: "Eczane kazancı" });
    expect(within(panel).getByText("20.000 TL")).toBeTruthy();
    expect(within(panel).getByText("24.000 TL")).toBeTruthy();
    expect(within(panel).getByText("4.000 TL")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Siparişi tamamla/ }));
    const shareButton = screen.getByRole("button", { name: /WhatsApp ile paylaş/ });
    expect((shareButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole("combobox", { name: /Eczane adı/ }), {
      target: { value: "Şifa Eczanesi" },
    });
    fireEvent.click(screen.getByRole("button", { name: /WhatsApp ile paylaş/ }));

    await waitFor(() => expect(share.sharePng).toHaveBeenCalledOnce());
    const [, fileName] = vi.mocked(share.sharePng).mock.calls[0]!;
    expect(fileName).toBe("Siparis_sifa-eczanesi_2026-09-25_VU-20260925-01.png");
    await waitFor(() => expect(mem.getItem("snn-siparis.orders")).toContain("VU-20260925-01"));
    expect(mem.getItem("snn-siparis.orders")).toContain('"status":"shared"');
    expect(mem.getItem("snn-siparis.cart")).toContain('"lines":[]');
  });

  it("yarım kalan sepet açılışta devam sorusu gösterir (S2)", () => {
    const mem = new MemoryStorage();
    mem.setItem(
      "snn-siparis.cart",
      JSON.stringify({
        version: 1,
        data: {
          lines: [
            {
              variantId: "magmeda-60",
              qty: 3,
              mfOverride: null,
              markupOverride: null,
              unitAtAdd: 45800,
            },
          ],
          markupOverride: null,
          pharmacy: { name: "Deva Eczanesi", district: "", address: "", phone: "" },
          note: "",
        },
      }),
    );
    setup(mem);
    expect(screen.getByText("Deva Eczanesi için açık sepet var.")).toBeTruthy();
  });
});

describe("yönetim", () => {
  it("şifre 0 ile açılır, yanlışta açılmaz", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Yönetim" }));
    const pass = await screen.findByLabelText("Şifre");
    fireEvent.change(pass, { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Aç" }));
    expect(screen.getByText("Şifre yanlış.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Şifre"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Aç" }));
    expect(await screen.findByText("Yönetim modu")).toBeTruthy();
  });
});

describe("maliyet sızıntısı (G2)", () => {
  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? files(path) : [path];
    });
  }

  it("satış ekranları ve ortak parçalar maliyet kodunu anmaz", () => {
    const root = join(process.cwd(), "src", "presentation");
    const sources = [...files(join(root, "sales")), ...files(join(root, "parts"))].filter(
      (f) => !f.endsWith(".test.tsx"),
    );
    for (const file of sources) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/costs|costMinor|maliyet/i);
    }
  });
});
