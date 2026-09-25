import { toBlob } from "html-to-image";
import type { PngRenderer } from "../../application/ports/devices.ts";

/** Sipariş resmi: 1080 px genişlik, pixelRatio 2 değil 1 — belge zaten 1080 px çizilir (PRD §6). */
export function createPngRenderer(): PngRenderer {
  return {
    async render(node) {
      await document.fonts.ready;
      const blob = await toBlob(node, {
        pixelRatio: 1,
        backgroundColor: "#ffffff",
        cacheBust: true,
        width: node.scrollWidth,
        height: node.scrollHeight,
      });
      if (blob === null) throw new Error("PNG üretilemedi.");
      return blob;
    },
  };
}
