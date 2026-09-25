import type { ShareOutcome, ShareService } from "../../application/ports/devices.ts";

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** Web Share API ile WhatsApp'a; desteklenmezse indir + kopyala + WhatsApp Web (P1). */
export function createBrowserShare(): ShareService {
  const service: ShareService = {
    canShareFiles() {
      if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") {
        return false;
      }
      const probe = new File([new Uint8Array(1)], "probe.png", { type: "image/png" });
      try {
        return navigator.canShare({ files: [probe] });
      } catch {
        return false;
      }
    },

    async sharePng(blob, fileName, title): Promise<ShareOutcome> {
      const file = new File([blob], fileName, { type: "image/png" });
      if (service.canShareFiles() && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title });
          return { kind: "shared" };
        } catch (error) {
          if (isAbort(error)) return { kind: "cancelled" };
          return { kind: "failed", message: "Paylaşım menüsü açılamadı." };
        }
      }
      service.download(blob, fileName);
      const copied = await service.copyImage(blob);
      service.openWhatsAppWeb();
      return { kind: "fallback", downloaded: true, copied };
    },

    download(blob, fileName) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    },

    async copyImage(blob) {
      try {
        if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) return false;
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        return true;
      } catch {
        return false;
      }
    },

    openWhatsAppWeb() {
      window.open("https://web.whatsapp.com/", "_blank", "noopener");
    },
  };
  return service;
}
