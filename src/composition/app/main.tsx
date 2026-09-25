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

/** Tek bağlama noktası: depolar, tarayıcı yetenekleri, başlangıç verisi ve PWA güncellemesi. */
function createUpdateSignal(): UpdateSignal {
  let ready = false;
  const listeners = new Set<(ready: boolean) => void>();
  const update = registerSW({
    onNeedRefresh() {
      ready = true;
      listeners.forEach((l) => l(true));
    },
  });
  return {
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
