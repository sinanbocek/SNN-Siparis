/** Arayüz derlemesi: React 19 + Vite 6 + PWA (çevrimdışı açılış, güncelleme bandı). Testler: vitest.config.ts */
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // "prompt": yeni sürüm kendiliğinden devreye girmez; kullanıcı "Yenile"ye basar (W1).
      registerType: "prompt",
      includeAssets: ["favicon.svg", "apple-touch-icon.png", "robots.txt"],
      manifest: {
        name: "SNN Sipariş",
        short_name: "SNN Sipariş",
        description: "Eczane sipariş aracı",
        lang: "tr",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "any",
        background_color: "#f5f6f8",
        theme_color: "#1b2a41",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webp,woff2}"],
        navigateFallback: "/index.html",
      },
    }),
  ],
  build: { outDir: "dist/app" },
});
