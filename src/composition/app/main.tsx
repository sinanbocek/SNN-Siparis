import "@fontsource-variable/inter";
import "../../presentation/parts/global.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { createCanvasResizer } from "../../infrastructure/image/canvasResizer.ts";
import { createPngRenderer } from "../../infrastructure/png/htmlToPng.ts";
import { createBrowserShare } from "../../infrastructure/share/browserShare.ts";
import { probeStorage } from "../../infrastructure/storage/localDocumentStore.ts";
import { createCostStore, createSalesStores } from "../../infrastructure/storage/stores.ts";
import { DEFAULT_SETTINGS } from "../../domain/settings/settings.ts";
import { App, type UpdateSignal } from "../../presentation/app/App.tsx";
import { SEED_CATALOG, SEED_IMAGES } from "../seed/seed.ts";
import { version } from "../../../package.json";

/** Tek bağlama noktası: depolar, tarayıcı yetenekleri, başlangıç verisi ve PWA güncellemesi. */
function createUpdateSignal(): UpdateSignal {
  let ready = false;
  let registration: ServiceWorkerRegistration | undefined;
  const listeners = new Set<(ready: boolean) => void>();
  const update = registerSW({
    onNeedRefresh() {
      ready = true;
      listeners.forEach((l) => l(true));
    },
    onRegisteredSW(_url, reg) {
      registration = reg;
    },
  });
  return {
    version,
    async check() {
      if (registration === undefined) return "unavailable";
      try {
        await registration.update();
      } catch {
        return "failed";
      }
      return ready || registration.installing !== null || registration.waiting !== null
        ? "ready"
        : "current";
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(ready);
      return () => listeners.delete(listener);
    },
    apply() {
      void update(true);
    },
  };
}

const storage = probeStorage(typeof window === "undefined" ? undefined : window.localStorage);
const root = document.getElementById("root");
if (root === null) throw new Error("#root bulunamadı");

createRoot(root).render(
  <StrictMode>
    <App
      stores={createSalesStores(storage)}
      seed={{ catalog: SEED_CATALOG, settings: DEFAULT_SETTINGS, images: SEED_IMAGES }}
      share={createBrowserShare()}
      png={createPngRenderer()}
      resizer={createCanvasResizer()}
      updates={createUpdateSignal()}
      now={() => new Date().toISOString()}
      admin={{ costStore: createCostStore(storage) }}
    />
  </StrictMode>,
);
