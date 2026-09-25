import { math } from "@snn/abacus-core";
import type { ImageResizer } from "../../application/ports/devices.ts";

const MAX_EDGE = 600;
const QUALITY = 0.8;

/** Tarayıcıda küçültme: uzun kenar 600 px, WebP (hedef 40–80 KB). */
export function createCanvasResizer(): ImageResizer {
  return {
    async resize(file) {
      const bitmap = await createImageBitmap(file);
      const longest = math.max(bitmap.width, bitmap.height);
      const scale = longest === null || longest <= MAX_EDGE ? 1 : math.div(MAX_EDGE, longest);
      const factor = scale === null ? 1 : scale;
      const width = math.round(math.mul(bitmap.width, factor), 0);
      const height = math.round(math.mul(bitmap.height, factor), 0);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (context === null) throw new Error("Görsel işlenemedi.");
      context.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();
      const webp = canvas.toDataURL("image/webp", QUALITY);
      // Eski Safari WebP yazamaz ve sessizce PNG döner; o zaman daha küçük olan JPEG.
      return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", QUALITY);
    },
  };
}
