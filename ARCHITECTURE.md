# ARCHITECTURE — SNN Sipariş

> Katman düzeni SNN-Ihale-Maliyet-Teklif-Yonetimi ile aynıdır; tek fark maliyetin ayrı bir
> katmanda kilitli olmasıdır (ADR-0002).

## 1. Yığın

| Katman | Seçim                                                      |
| ------ | ---------------------------------------------------------- |
| Çatı   | React 19 · Vite 6 · TypeScript (en katı ayarlar) · Node 24 |
| Hesap  | `@snn/abacus-core` ^4.3 (`math`, `money`, `text`, `date`)  |
| PNG    | `html-to-image`                                            |
| PWA    | `vite-plugin-pwa` (Workbox), `registerType: "prompt"`      |
| Yazı   | `@fontsource-variable/inter` (cihazda, internetsiz)        |
| İkon   | Hugeicons ücretsiz (MIT)                                   |
| Stil   | CSS Modules + `presentation/parts/global.css` belirteçleri |
| Test   | Vitest + Testing Library (arayüz testleri jsdom)           |
| Yayın  | Firebase Hosting `snn-siparis`, **elle**: `npm run deploy` |

## 2. Dizinler

```
src/
  domain/
    abacus/        ABACUS kapısı (çekirdeği iç katmanlara açar)
    pricing/       PSF, yuvarlama, KDV, uyarılar
    costs/         maliyet + kâr modu — YALNIZ yönetim (ADR-0002)
    catalog/       aile, varyant, MF kuralı
    cart/          sepet, MF, toplamlar, eczacı kazancı
    order/         sipariş anlık görüntüsü, no, dosya adı
    input/         "%20", "1.116,67" okuma
    settings/      ayarlar ve varsayılanlar
  application/
    ports/         depo ve cihaz portları
    admin/         fiyat işlemleri, yedek, maliyet deposu portu, raporlar, örnek veri
    validation.ts  cihazdan/yedekten okunan verinin şekil denetimi
    session.ts     görsel seçimi, arama, sipariş süzgeci, İstanbul günü
  infrastructure/  localStorage, Web Share, html-to-image, görsel küçültme
  presentation/
    parts/         ortak parçalar, biçim yardımcıları
    sales/         katalog, sepet, tamamla, sipariş resmi, siparişler
    admin/         kilit, raporlar (SVG grafikler), fiyatlama, ürünler, ayarlar, veri
    app/           kabuk: gezinme, veri yükleme/kaydetme, bantlar
  composition/
    app/main.tsx   tek bağlama noktası
    seed/          başlangıç verisi (maliyetsiz)
public/products/   600 px WebP kutu görselleri
```

## 3. Bağımlılık kuralları (eslint-plugin-boundaries, hepsi `error`)

| Kimden         | Kime                                                      |
| -------------- | --------------------------------------------------------- |
| domain         | domain, abacus                                            |
| costs          | costs, domain, abacus                                     |
| application    | application, domain, abacus                               |
| admin-app      | admin-app, application, costs, domain, abacus             |
| infrastructure | infrastructure, admin-app, application, costs, domain     |
| ui-parts       | ui-parts, application, domain                             |
| **sales-ui**   | sales-ui, ui-parts, application, domain — **costs YOK**   |
| admin-ui       | admin-ui, ui-parts, admin-app, application, costs, domain |
| shell          | shell, sales-ui, admin-ui, ui-parts, application, domain  |
| composition    | hepsi                                                     |

İç katmanlar dış paket olarak yalnız `@snn/abacus-core` alabilir.

Ek kapılar: ham `Math.*`, `parseFloat`, `Intl`, `toFixed`, `toLocale*`, `?? 0`, elle `₺`/`TL`
yasak. CI'da sunum katmanı için ABACUS grep kapısı ve satış ekranları için maliyet kapısı var.

## 4. Veri

- localStorage anahtarları `snn-siparis.<ad>`: `settings`, `catalog`, `costs`, `images`, `cart`,
  `orders`, `meta`. Her kayıt `{ version: 1, data }` zarfındadır. Bozuk kayıt üzerine yazılmadan
  önce `.corrupt-backup` anahtarına kopyalanır.
- Maliyet (`costs`) yalnız yönetim kilidi açıkken belleğe alınır. Yönetim kodu ayrı parça
  (lazy chunk) olarak yüklenir.
- Kullanıcı görselleri `images` anahtarında data URL; başlangıç görselleri `public/products`.
- Yedek dosyası: `snn-siparis-yedek_<gün>[_MALIYETLI].json`.

## 5. Hesap akışı

`summarizeCart(catalog, settings, cart)`:

- satır tutarı = adet × satış (iki tam sayı, yuvarlama yok)
- KDV oran grubunda Σ üzerinden bir kez
- raf geliri = Σ adet × PSF; eczacı kazancı = raf geliri − toplam
- MF kazanca eklenmez; MF kutuların raf değeri yalnız bilgi olarak gösterilir

## 6. Yayın

```
npm run deploy
```

Sırası: build (lint + tip + vite) → test → `firebase deploy --only hosting`.
`firebase.json`: `index.html`, `sw.js`, `manifest.webmanifest` → `no-cache`; hash'li varlıklar
1 yıl; tüm yanıtlarda `X-Robots-Tag: noindex`.
