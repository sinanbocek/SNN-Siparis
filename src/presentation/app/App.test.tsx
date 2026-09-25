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
  it("silinen siparişin numarası yeniden verilmez (-01 silinince yeni sipariş -02)", async () => {
    const { mem, share } = setup();
    const shareOnce = async (expected: string) => {
      fireEvent.click(screen.getByRole("button", { name: "Gardegen 60 Kapsül artır" }));
      fireEvent.click(screen.getAllByRole("button", { name: /^Sepet/ })[0]!);
      fireEvent.click(screen.getByRole("button", { name: /Siparişi tamamla/ }));
      fireEvent.change(screen.getByRole("combobox", { name: /Eczane adı/ }), {
        target: { value: "Şifa Eczanesi" },
      });
      fireEvent.click(screen.getByRole("button", { name: /WhatsApp ile paylaş/ }));
      await waitFor(() => expect(mem.getItem("snn-siparis.orders")).toContain(expected));
    };
    await shareOnce("VU-20260925-01");
    fireEvent.click(screen.getAllByRole("button", { name: /Siparişler/ })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "VU-20260925-01 sil" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Sipariş silinsin mi?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Sil" }));
    await waitFor(() => expect(mem.getItem("snn-siparis.orders")).toContain('"data":[]'));
    fireEvent.click(screen.getAllByRole("button", { name: /Katalog/ })[0]!);
    await shareOnce("VU-20260925-02");
    expect(vi.mocked(share.sharePng).mock.calls[1]![1]).toContain("VU-20260925-02");
  });

  it("katalogdan adet → sepette eczacı kazancı → paylaş → geçmiş", async () => {
    const { mem, share } = setup();
    fireEvent.click(screen.getAllByRole("button", { name: "Gardegen 60 Kapsül artır" })[0]!);
    const qty = screen.getByRole("textbox", { name: "Gardegen 60 Kapsül adet" });
    fireEvent.change(qty, { target: { value: "10" } });
    fireEvent.blur(qty);

    fireEvent.click(screen.getAllByRole("button", { name: /^Sepet/ })[0]!);
    const panel = screen.getByRole("complementary", { name: "Eczane kazancı" });
    expect(within(panel).getByText("₺20.000,00")).toBeTruthy();
    expect(within(panel).getByText("₺24.000,00")).toBeTruthy();
    expect(within(panel).getByText("₺4.000,00")).toBeTruthy();

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

describe("revizyon 2", () => {
  it("sepette − ile sıfıra inen ürün 'Geri al' ile geri gelir", async () => {
    const { mem } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Gardegen 60 Kapsül artır" }));
    fireEvent.click(screen.getAllByRole("button", { name: /^Sepet/ })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Gardegen 60 Kapsül azalt" }));
    expect(await screen.findByText("Gardegen 60 Kapsül sepetten çıkarıldı.")).toBeTruthy();
    await waitFor(() => expect(mem.getItem("snn-siparis.cart")).toContain('"lines":[]'));
    fireEvent.click(screen.getByRole("button", { name: "Geri al" }));
    await waitFor(() => expect(mem.getItem("snn-siparis.cart")).toContain("gardegen-60"));
  });

  it("eczane adında boşluk yazılabilir; telefon yalnız rakam", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Gardegen 60 Kapsül artır" }));
    fireEvent.click(screen.getAllByRole("button", { name: /^Sepet/ })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Siparişi tamamla" }));
    const name = screen.getByRole("combobox", { name: /Eczane adı/ });
    fireEvent.change(name, { target: { value: "Şifa " } });
    expect((name as HTMLInputElement).value).toBe("Şifa ");
    fireEvent.change(name, { target: { value: "Şifa Eczanesi" } });
    expect((name as HTMLInputElement).value).toBe("Şifa Eczanesi");
    const phone = screen.getByRole("textbox", { name: "Eczane telefonu" });
    fireEvent.change(phone, { target: { value: "0264 abc 123-45-67" } });
    expect((phone as HTMLInputElement).value).toBe("02641234567");
  });

  it("sepeti temizle: onay penceresi, sonra 'Geri al' bildirimi", async () => {
    const { mem } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Gardegen 60 Kapsül artır" }));
    fireEvent.click(screen.getAllByRole("button", { name: /^Sepet/ })[0]!);
    fireEvent.click(screen.getByRole("button", { name: /Sepeti temizle/ }));
    const dialog = await screen.findByRole("alertdialog", { name: "Sepet temizlensin mi?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Temizle" }));
    await waitFor(() => expect(mem.getItem("snn-siparis.cart")).toContain('"lines":[]'));
    fireEvent.click(await screen.findByRole("button", { name: "Geri al" }));
    await waitFor(() => expect(mem.getItem("snn-siparis.cart")).toContain("gardegen-60"));
  });

  it("sepette perakende satış fiyatı yazılınca eczacı kârı ondan hesaplanır", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Gardegen 60 Kapsül artır" }));
    fireEvent.click(screen.getAllByRole("button", { name: /^Sepet/ })[0]!);
    const psf = screen.getByRole("textbox", { name: "Gardegen 60 Kapsül perakende satış fiyatı" });
    fireEvent.change(psf, { target: { value: "2500" } });
    fireEvent.blur(psf);
    // 2.500 ÷ 2.000 − 1 = %25; kazanç 500
    expect(await screen.findByText("Eczacı kârı %25")).toBeTruthy();
    const panel = screen.getByRole("complementary", { name: "Eczane kazancı" });
    expect(within(panel).getByText("₺500,00")).toBeTruthy();
  });
});

describe("yönetim", () => {
  it("şifre kendiliğinden denenir: yanlışta açılmaz, 0 ile açılır; telefonda rakam klavyesi", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Yönetim" }));
    const pass = await screen.findByLabelText("Şifre");
    expect(pass.getAttribute("inputmode")).toBe("numeric");
    fireEvent.change(pass, { target: { value: "1" } });
    expect(screen.getByText("Şifre yanlış.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Şifre"), { target: { value: "0" } });
    expect(await screen.findByText("Yönetim")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Yönetim sekmeleri" })).toBeTruthy();
  });
});

describe("sipariş düzenle / sil", () => {
  const order = {
    no: "VU-20260925-01",
    createdAt: "2026-09-25T08:00:00.000Z",
    day: "2026-09-25",
    pharmacy: { name: "Deva Eczanesi", district: "", address: "", phone: "" },
    note: "",
    repName: "Volkan ULU",
    repPhone: "0 555 555 55 55",
    headerTitle: "Sipariş Formu",
    lines: [
      {
        variantId: "magmeda-60",
        label: "Magmeda-6 60 Kapsül",
        qty: 3,
        mf: 0,
        unitMinor: 45800,
        amountMinor: 137400,
        vatRate: 0.01,
      },
    ],
    netMinor: 137400,
    vatGroups: [{ rate: 0.01, baseMinor: 137400, vatMinor: 1374 }],
    grossMinor: 138774,
    status: "shared",
    shareCount: 1,
  };

  function withOrder() {
    const mem = new MemoryStorage();
    mem.setItem("snn-siparis.orders", JSON.stringify({ version: 1, data: [order] }));
    return setup(mem);
  }

  it("liste Abacus biçimiyle: ₺ tutar ve '25 Eyl. 11:00'", () => {
    withOrder();
    fireEvent.click(screen.getAllByRole("button", { name: /Siparişler/ })[0]!);
    expect(screen.getByText("₺1.387,74")).toBeTruthy();
    expect(screen.getByText(/VU-20260925-01 · 25 Eyl\. 11:00/)).toBeTruthy();
  });

  it("sil: uygulamanın onay penceresiyle kayıttan çıkar, bildirim gösterir", async () => {
    const { mem } = withOrder();
    fireEvent.click(screen.getAllByRole("button", { name: /Siparişler/ })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "VU-20260925-01 sil" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Sipariş silinsin mi?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Sil" }));
    await waitFor(() => expect(mem.getItem("snn-siparis.orders")).toContain('"data":[]'));
    expect(await screen.findByText("VU-20260925-01 silindi.")).toBeTruthy();
  });

  it("düzenle: aynı numarayla sepete açılır, paylaşınca aynı kayıt güncellenir", async () => {
    const { mem, share } = withOrder();
    fireEvent.click(screen.getAllByRole("button", { name: /Siparişler/ })[0]!);
    fireEvent.click(screen.getByRole("button", { name: /Deva Eczanesi/ }));
    fireEvent.click(screen.getByRole("button", { name: /Düzenle/ }));
    expect(
      screen.getByText("VU-20260925-01 düzenleniyor. Paylaşınca kayıt güncellenir."),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Magmeda-6 60 Kapsül artır" }));
    fireEvent.click(screen.getByRole("button", { name: "Siparişi güncelle" }));
    fireEvent.click(screen.getByRole("button", { name: /WhatsApp ile paylaş/ }));
    await waitFor(() => expect(share.sharePng).toHaveBeenCalledOnce());
    await waitFor(() => expect(mem.getItem("snn-siparis.orders")).toContain('"qty":4'));
    const saved = JSON.parse(mem.getItem("snn-siparis.orders")!).data;
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      no: "VU-20260925-01",
      shareCount: 2,
      createdAt: order.createdAt,
    });
    expect(saved[0].updatedAt).toBe("2026-09-25T10:00:00.000Z");
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
