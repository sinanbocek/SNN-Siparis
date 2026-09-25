# SNN Sipariş — PRD (MVP)

> **Durum:** v0.2 · 25.09.2026 · kararlar kilitlendi, MVP kodlandı
> **Kullanıcı:** Volkan ULU (ilaç/takviye pazarlamacısı) · 0 555 555 55 55 (yer tutucu)
> **Geliştirici:** Sinan Böcek
> **Repo:** `SNN-Siparis` (public) · **Hosting:** Firebase Hosting (`snn-siparis`), elle yayın · **Veritabanı:** yok (MVP)

---

## İçindekiler

1. [Amaç ve kapsam](#1-amaç-ve-kapsam)
2. [Kilitlenen kararlar](#2-kilitlenen-kararlar)
3. [Kullanıcı ve ortam](#3-kullanıcı-ve-ortam)
4. [Uçtan uca akışlar](#4-uçtan-uca-akışlar)
5. [Arayüz (UI)](#5-arayüz-ui)
6. [Sipariş PNG şablonu](#6-sipariş-png-şablonu)
7. [Hesap kuralları](#7-hesap-kuralları)
8. [Veri modeli](#8-veri-modeli)
9. [Teknik mimari](#9-teknik-mimari)
10. [Riskler ve test senaryoları](#10-riskler-ve-test-senaryoları)
11. [Kabul kriterleri](#11-kabul-kriterleri)
12. [Yol haritası](#12-yol-haritası)
13. [Açık kararlar](#13-açık-kararlar)
14. [Ek A — Başlangıç verisi](#ek-a--başlangıç-verisi)
15. [Ek B — Mevcut projelerden alınacaklar](#ek-b--mevcut-projelerden-alınacaklar)

## 0. Karar kaydı (v0.2, proje sahibi onayı 25.09.2026)

Bu bölüm aşağıdaki metnin önüne geçer; çelişkide bu tablo geçerlidir.

| #   | Konu                       | Karar                                                                                                                                                                                                          |
| --- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K1  | Proje / depo adı           | `SNN-Siparis`, GitHub'da **public** (CI dakika kotası)                                                                                                                                                         |
| K2  | Yayın                      | GitHub'dan otomatik yayın **yok**; bilgisayardan `npm run deploy` (Firebase CLI)                                                                                                                               |
| K3  | Firebase proje kimliği     | `snn-siparis` → `snn-siparis.web.app`                                                                                                                                                                          |
| K4  | Pazarlamacı telefonu       | Kodda `0 555 555 55 55` yer tutucu; gerçek numara Ayarlar'dan cihaza yazılır                                                                                                                                   |
| K5  | Pazarlamacı adı            | Kodda varsayılan "Volkan ULU" kalır                                                                                                                                                                            |
| K6  | Başlangıç fiyatları        | Kodda kalır (herkese açık olması kabul edildi)                                                                                                                                                                 |
| K7  | Yuvarlama adımı            | 1 TL (satış = PSF ÷ 1,20 → 1 TL; PSF tabloya birebir döner)                                                                                                                                                    |
| K8  | KDV                        | %1, tüm ürünler; ürün başına oran alanı var                                                                                                                                                                    |
| K9  | Cihaz                      | Tablet ve telefon uyumlu; Chrome ve Safari                                                                                                                                                                     |
| K10 | MF                         | MVP'de var. Kural yönetimde ürün başına, katlanarak ("10 alana 1": 25 kutu → 2 MF); sepette o sipariş için elle değişir; eczacı kazancına **eklenmez**, panelde bilgi satırı; resimde adet "12 adet (10+2 MF)" |
| K11 | Eczacıya ayrı kazanç resmi | MVP sonrası                                                                                                                                                                                                    |
| K12 | Branş                      | MVP'de yok (filtre ve etiket kaldırıldı); gerekirse MVP sonrası                                                                                                                                                |
| K13 | Sipariş resmi              | Logo yok, yer tutucu çerçeve; büyük yazılı kart düzeni (E3 B)                                                                                                                                                  |
| K14 | Katalog                    | Kart ↔ liste geçişi (E1)                                                                                                                                                                                       |
| K15 | Sepet                      | Solda tablo, sağda kazanç paneli (E2 A); telefonda üstte kazanç şeridi (S8)                                                                                                                                    |
| K16 | Renk                       | Nötr + lacivert vurgu (P1 A); Stomagen açık mor (P2 b)                                                                                                                                                         |
| K17 | Sipariş no                 | Cihaz harfi yok (S9 b): `VU-20260925-01`                                                                                                                                                                       |
| K18 | İkon                       | Hugeicons (MIT); ana ekran simgesi lacivert zemin + "SNN" + sepet                                                                                                                                              |
| K19 | Görsel                     | Görseli olmayan varyant aile görselini kullanır; D-Panthenol ve Kantaron ayrı aile, gri yer tutucu                                                                                                             |
| K20 | Vivagen kutu yazısı        | "Ginkgo Biloba ve Vitamin Kompleksi" doğru                                                                                                                                                                     |
| K21 | PNG                        | `html-to-image`; PWA MVP'de; ham `Math.*` yasak; belge seti ihale düzeninde                                                                                                                                    |
| K22 | Hesap                      | SNN-Abacus-Core ile; KDV/kâr/MF kuralları projede (Abacus'ta yok)                                                                                                                                              |

---

## 1. Amaç ve kapsam

Pazarlamacı eczaneye tabletle gider; ürünleri katalog olarak gösterir, eczacının istediği adetleri girer, eczacıya **"kaç para ödersin, rafta satınca kaç para kazanırsın"** hesabını anında gösterir. El sıkışılınca sipariş formu **PNG** olarak üretilir ve **WhatsApp** ile depoya gönderilir. Pazarlamacı, şifreli admin panelinde kendi maliyetini, kâr marjını ve satış fiyatlarını yönetir.

**Fiyat zinciri**

```
Bizim maliyet ──(bizim kâr)──▶ Bizim satış = Eczane alışı ──(eczacı kârı)──▶ PSF (nihai tüketici)
```

### MVP'de var

- Ürün kataloğu (aile → varyant), branş filtresi, görsel veya yer tutucu
- Katalogda doğrudan adet girişi, satır tutarı ve dip toplam (KDV hariç / KDV / genel toplam)
- Eczacı kazanç simülasyonu (sipariş bazında ± eczacı kâr oranı)
- Sipariş formu → PNG → Web Share ile WhatsApp
- Sipariş geçmişi (yeniden paylaş, tekrar sipariş)
- Şifreli admin: ürünler, maliyet, kâr modu, satış fiyatı, PSF, ayarlar
- JSON yedek al / yükle (cihazlar arası tek köprü)
- PWA: ana ekrana ekleme, çevrimdışı açılış, güncelleme bandı

### MVP'de yok

- Veritabanı, çoklu cihaz senkronu, çoklu kullanıcı
- Gerçek kimlik doğrulama
- PDF ve e-posta gönderimi
- SEM (saç ekim merkezi) fiyat listesi
- MF (mal fazlası) ve vade — bkz. [Açık kararlar](#13-açık-kararlar)
- Stok, raporlama, fatura

---

## 2. Kilitlenen kararlar

| Konu             | Karar                                                                    |
| ---------------- | ------------------------------------------------------------------------ |
| Admin kilidi     | Geçici şifre **"0"**; yalnız perde, gerçek güvenlik MVP sonrası          |
| Maliyet          | **Koda asla girmez**; yalnız cihazda, admin panelinden girilir           |
| Depolama         | localStorage (resimler küçültülerek; bkz. D3)                            |
| Fiyatlar         | Tümü **KDV hariç**; KDV oranı admin'de hazır alan                        |
| PSF              | Varsayılan **satış × 1,20** (eczacıya %20 markup); elle ± değişir        |
| Başlangıç verisi | PSF tablosu; satış = PSF ÷ 1,20; maliyet boş                             |
| Maliyet tahmini  | Admin'de "%40 marjdan tahmin et" butonu (maliyet = satış × 0,60)         |
| Gönderim         | **Yalnız PNG**, WhatsApp üzerinden (Web Share API)                       |
| Eczane bilgisi   | Eczane adı zorunlu; il/ilçe, adres, telefon, not **opsiyonel**           |
| Pazarlamacı      | Volkan ULU · 0 555 555 55 55 (yer tutucu) · adres yok                    |
| Hesap motoru     | **SNN-Abacus-Core ^4.3** · kuruş tam sayı · KDV toplam üzerinden bir kez |
| Belge dili       | İhale projesindeki `CompanyHeader` / `QuoteSheet` görünümü               |
| Görseller        | Mockup'lar örnek; kullanıcı değiştirir, olmayanlara yer tutucu           |
| Repo / hosting   | Public GitHub repo · Firebase Hosting · GitHub Actions ile yayın         |

---

## 3. Kullanıcı ve ortam

- **Tek kullanıcı:** Volkan. **Birincil cihaz:** tablet (işletim sistemi belirlenecek). **İkincil:** PC.
- **Kullanım anı:** Eczane tezgâhı. Ayakta, kısa süreli, eczacı ekrana bakıyor, araya müşteri giriyor, mobil çekim zayıf olabilir.
- **Tasarım hedefi:** Eczacı ekrana baktığında **5 saniyede** ödeyeceği ve kazanacağı tutarı görmeli.
- **Süre hedefi:** Katalogdan WhatsApp gönderimine kadar bir sipariş **2 dakikanın altında**.

---

## 4. Uçtan uca akışlar

### A. İlk kurulum (bir kez)

1. Site açılır → ana ekrana eklenir (PWA).
2. İlk açılışta başlangıç verisi yüklenir: 7 aile, 14 SKU ([Ek A](#ek-a--başlangıç-verisi)).
3. ⚙ → şifre "0" → **Ayarlar:** pazarlamacı adı/telefonu, KDV oranı, yuvarlama adımı, eczacı varsayılan %'si.
4. **Fiyatlama:** maliyetler girilir veya "%40 marjdan tahmin et" kullanılır; kâr modu seçilir; satış fiyatları kontrol edilir.
5. **Ürünler:** gerçek kutu görselleri yüklenir (isteğe bağlı).
6. **Veri:** ilk yedek alınır.

### B. Fiyat güncelleme (arada bir)

1. Admin → Fiyatlama → tekli veya toplu değişiklik ("seçili ürünlere +%5, 10 TL'ye yuvarla").
2. Uyarılar kontrol edilir (eczacı marjı düşük, satış ≥ PSF).
3. Kaydet → yedek hatırlatması.

### C. Saha ziyareti (asıl akış)

1. Uygulama açılır. Açık sepet varsa: **"XYZ Eczanesi'ne devam et / Yeni başlat"**.
2. **Katalog:** ürünler gösterilir; gerekirse branşa göre süzülür.
3. Eczacının istediği adetler katalog kartlarında stepper ile girilir (ayrı "sepete ekle" adımı yok).
4. **Sepet:** solda satırlar ve toplamlar, sağda **Eczane Kazancı** paneli.
5. Pazarlıkta eczacı kâr oranı ± ile değiştirilir (**yalnız bu sipariş** için).
6. El sıkışılır.

### D. Sipariş gönderimi

1. **Siparişi tamamla** → eczane adı (zorunlu, geçmişten otomatik tamamlama), il/ilçe, adres, telefon, not.
2. PNG önizlemesi.
3. **WhatsApp ile paylaş** → sistem paylaşım menüsü → WhatsApp → depo sohbeti → gönder.
4. Paylaşım başarılı dönerse sipariş **"paylaşıldı"** olarak geçmişe kaydedilir; sepet sıfırlanır.
5. Paylaşım desteklenmiyorsa (PC): PNG indir + panoya kopyala + WhatsApp Web aç.

### E. Sipariş geçmişi

- Liste: sipariş no, tarih, eczane, genel toplam, durum.
- İşlemler: **PNG'yi yeniden paylaş**, **Yeni sepete kopyala** (tekrar sipariş; güncel fiyatlarla).

### F. Cihaz değiştirme / aktarım

Admin → Veri → **Yedek al** (JSON; "maliyetler dahil" seçimi) → diğer cihazda **Yedek yükle** → özet önizleme ("14 ürün, maliyetler var, 12 sipariş") → onay.

### G. Sürüm güncelleme

Yeni sürüm yayınlanır → tablette **"Yeni sürüm hazır — Yenile"** bandı → yenileme sonrası sepet ve tüm veri korunur.

---

## 5. Arayüz (UI)

### 5.1 Tasarım ilkeleri

- **Tablet yatay birincil**, dikey de çalışır; PC'de aynı arayüz geniş ekrana yayılır.
- **Dokunma alanları ≥ 48 px.** Adet: büyük − / + stepper, dokununca sayısal klavye (`inputmode="numeric"`), +5 / +10 kısayolları.
- **Rakamlar:** Inter, `tabular-nums`, TL değerleri sağa hizalı. Eczacı panelindeki rakamlar ekranın en büyük yazıları.
- **Görsel dil:** Beyaz zemin, nötr griler; her ürün ailesi kendi aksan rengini taşır. Mockup'lardaki çapraz şerit motifi kartlarda hafifçe. Medikal, sade, güven veren.
- **Açık tema sabit**, yüksek kontrast (parlak eczane ortamı).
- **Satış ekranlarında maliyet hiçbir biçimde bulunmaz.** Admin ayrı dünya: farklı renkte üst bant, "Admin modu" etiketi.

### 5.2 Gezinme

- Üst bant: solda **Volkan ULU**, ortada **Katalog · Sepet (rozet) · Siparişler**, sağda küçük **⚙**.
- ⚙ → şifre ekranı → Admin.
- Admin'den çıkınca veya **5 dk işlemsizlikte** otomatik kilit.

### 5.3 Katalog

- Üstte arama kutusu ve **branş çipleri** (Tümü · KBB · Diş · Dermatoloji · Kadın Doğum · Üroloji · Gastro · Dahiliye · Nöroloji · Saç Ekimi).
- 2–3 sütun **aile kartları**. Kartta: görsel veya renkli yer tutucu, aile adı, branş etiketleri, varyant satırları.
- Varyant satırı: **varyant adı · eczaneye fiyat · PSF · adet stepper**.
- Adet girilen kart ince aksan çerçevesi alır; sepet rozeti artar.

### 5.4 Sepet ve hesap (ana ekran)

```
┌─────────────────────────────────────────────┬─────────────────────────┐
│ Ürün                Birim    Adet    Tutar  │  ECZANE KAZANCI         │
│ Gardegen 60 Kps   2.000,00  [−10+] 20.000,00│  Ödeyeceğiniz           │
│ Stomagen Sprey      408,33  [−24+]  9.800,00│    29.800,00 TL (KDV h.)│
│ ...                                         │  Rafta satınca          │
│─────────────────────────────────────────────│    35.760,00 TL         │
│ Toplam (KDV hariç)             29.800,00    │  Kazancınız             │
│ KDV (%x)                            ...     │     5.960,00 TL  (%20)  │
│ Genel toplam (KDV dahil)            ...     │  Eczacı kârı [− 20% +]  │
│           [Sepeti temizle]   [Siparişi tamamla →]                     │
└───────────────────────────────────────────────────────────────────────┘
```

- Satırdaki PSF'ye dokununca o satıra özel eczacı oranı girilebilir.
- Panelde ek satır: **Raf fiyatı (KDV dahil)** — tüketicinin göreceği fiyat.
- Dikey modda panel tablonun altına iner.

### 5.5 Siparişi tamamla

- Alt sayfa / modal. Solda form: **Eczane adı\***, il/ilçe, adres, telefon, not.
- Sağda canlı **PNG önizlemesi**.
- Butonlar: **WhatsApp ile paylaş** (birincil) · **PNG indir** · **Kopyala** (PC).

### 5.6 Siparişler

- Liste + filtre (bugün / bu hafta / tümü) + eczane araması.
- Satıra dokununca PNG önizlemesi ve işlemler.

### 5.7 Admin

| Sekme         | İçerik                                                                                                                                                                                        |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ürünler**   | Aile ekle/düzenle/sil (ad, renk, branş, görsel) · Varyant ekle/düzenle/sil (ad, birim) · Sürükleyerek sıralama · Yayında/gizli anahtarı                                                       |
| **Fiyatlama** | Tablo: Ürün · Maliyet · Kâr modu · Değer · Satış · Bizim kâr · PSF modu · PSF · Eczacı %. Satır seçimi + toplu işlem çubuğu (% / TL / yuvarla). Satır uyarı ikonları. "%40 marjdan tahmin et" |
| **Ayarlar**   | Pazarlamacı adı, telefon, PNG başlığı/marka, KDV oranı, yuvarlama adımı, eczacı varsayılan %'si, sipariş no öneki                                                                             |
| **Veri**      | Yedek al / yükle, son yedek tarihi, depolama kullanımı, başlangıç verisine sıfırla                                                                                                            |

### 5.8 Yer tutucu görsel

Aile rengiyle çizilmiş SVG kutu: çapraz şerit + ürün adı + varyant. Görseli olmayan ürün katalogda "eksik" görünmez.

---

## 6. Sipariş PNG şablonu

- **Genişlik 1080 px** (WhatsApp dostu), yükseklik içeriğe göre; `pixelRatio` 2.
- Gövde yazısı **≥ 28 px**, yüksek kontrast; WhatsApp sıkıştırmasına dayanıklı.
- Font: kendi sunucumuzdan Inter; üretimden önce `document.fonts.ready` beklenir.
- **Eczacı kazancı yer almaz.**

**İçerik sırası**

1. **SİPARİŞ FORMU** · Sipariş no · Tarih
2. Pazarlamacı: **Volkan ULU · 0 555 555 55 55 (yer tutucu)**
3. Eczane bloğu: ad, il/ilçe, adres, telefon (girilenler)
4. Tablo: **Sıra · Ürün · Adet · Birim fiyat · Tutar**
5. Toplam (KDV hariç) · KDV (oran bazında) · **Genel toplam (KDV dahil)**
6. "Yalnız … Lira … Kuruş" (`money.toWords`)
7. Not
8. Alt bilgi: "Fiyatlar KDV hariçtir."

**Dosya adı:** `Siparis_<eczane-ascii>_<YYYY-MM-DD>_<no>.png` (Abacus `text.toAsciiLower`).

---

## 7. Hesap kuralları

Tüm tutarlar **kuruş cinsinden tam sayı**; tüm işlemler **Abacus `math`** ile. Ham `Math.*`, `Intl`, `toLocale*`, `|| 0` yasak (Abacus kırmızı çizgileri).

| Hesap                  | Formül                                                                      |
| ---------------------- | --------------------------------------------------------------------------- |
| Satış — markup         | maliyet × (1 + r) → yuvarlama adımına                                       |
| Satış — marj           | maliyet ÷ (1 − m); **m < 1** zorunlu → yuvarlama adımına                    |
| Satış — sabit          | girilen değer; bizim kâr = satış − maliyet                                  |
| Satış — hedef kâr      | maliyet + X TL                                                              |
| PSF — hesaplanan       | satış × (1 + eczacı %) → yuvarlama adımına                                  |
| PSF — sabit            | girilen değer; eczacı % geri hesaplanır                                     |
| Satır tutarı           | adet × birim satış (ikisi de tam sayı → yuvarlama yok)                      |
| Toplam (KDV hariç)     | Σ satır tutarı                                                              |
| KDV                    | KDV oranına göre gruplanır; her grupta Σ üzerinden **bir kez** `vatOnMinor` |
| Genel toplam           | Toplam + Σ KDV                                                              |
| Eczacı raf geliri      | Σ adet × PSF (KDV hariç)                                                    |
| Eczacı kazancı         | Raf geliri − Toplam; oran = kazanç ÷ Toplam                                 |
| Raf fiyatı (KDV dahil) | PSF × (1 + KDV oranı) — yalnız bilgi amaçlı                                 |

**Kurallar**

- Maliyeti boş ürün: bizim kâr **"—"**, 0 sayılmaz.
- Kâr modu adları ihale projesindeki `ProfitPolicy` ile aynı: `markup` · `fixed_price` · `target_profit` (+ `margin`).
- Sipariş kaydedilirken **fiyatlar dondurulur** (anlık görüntü); sonraki fiyat değişiklikleri geçmişi etkilemez.
- Sepetteki eczacı % değişikliği admin varsayılanına **yazılmaz**.

---

## 8. Veri modeli

### 8.1 localStorage anahtarları (önek `vs:v1:`)

| Anahtar    | İçerik                                                          | Yedekte      |
| ---------- | --------------------------------------------------------------- | ------------ |
| `meta`     | Şema sürümü, son yedek tarihi, kurulum tarihi                   | ✔            |
| `settings` | Pazarlamacı, KDV, yuvarlama, eczacı varsayılan %, sipariş öneki | ✔            |
| `catalog`  | Aileler, varyantlar, satış, PSF modu/değeri (**maliyet yok**)   | ✔            |
| `costs`    | Varyant ID → maliyet, kâr modu, değer (**yalnız admin**)        | Seçime bağlı |
| `images`   | Aile/varyant ID → küçültülmüş WebP data URL                     | Seçime bağlı |
| `cart`     | Açık sepet, eczacı % değişiklikleri, eczane taslağı             | ✖            |
| `orders`   | Geçmiş siparişler (fiyat anlık görüntüsüyle)                    | ✔            |

### 8.2 Varlıklar (özet)

```ts
Family   { id, name, color, branches[], imageId?, order, active }
Variant  { id, familyId, name, unit: "kutu", salePriceMinor, psfMode: "computed"|"fixed",
           psfMinor?, pharmacistMarkup?, vatRate?, order, active }
Cost     { variantId, costMinor | null, policy: markup|margin|fixed_price|target_profit, value }
Settings { repName, repPhone, headerTitle, vatRate, roundingStepMinor,
           defaultPharmacistMarkup, orderPrefix }
CartLine { variantId, qty, pharmacistMarkupOverride? }
Order    { no, createdAt, pharmacy{name, district?, address?, phone?}, note?,
           lines[{name, qty, unitMinor, amountMinor, vatRate}], totals, status }
```

- **Sipariş no:** `VU-20260925-01` → önek (pazarlamacı baş harfleri) + tarih + günlük sıra.
- **Resim:** yüklemede tarayıcıda **~600 px WebP**'ye küçültülür (hedef 40–80 KB). Kota yetmezse sonraki adım IndexedDB.

---

## 9. Teknik mimari

| Katman          | Seçim                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------- |
| Çatı            | React 19 · Vite 6 · TypeScript strict                                                             |
| Yapı            | `domain / application / infrastructure / presentation / composition` (ihale projesiyle aynı)      |
| Sınır kuralları | `eslint-plugin-boundaries`; **satış bileşenleri `costs` tipini import edemez**                    |
| Hesap           | `@snn/abacus-core` (`github:sinanbocek/snn-abacus-core#semver:^4.3.0`)                            |
| PNG             | `html-to-image`                                                                                   |
| PWA             | `vite-plugin-pwa` (Workbox) + güncelleme bandı                                                    |
| Font            | `@fontsource-variable/inter` (self-host)                                                          |
| Test            | Vitest + Testing Library; domain önce, tablo testleri                                             |
| Kalite          | ESLint · Prettier · Husky + lint-staged · Abacus ESLint yapılandırması                            |
| Hosting         | Firebase Hosting; SPA rewrite                                                                     |
| Önbellek        | `index.html`, `sw.js`, `manifest` → `no-cache`; hash'li varlıklar → uzun süreli                   |
| Arama motoru    | `robots.txt` + `X-Robots-Tag: noindex`                                                            |
| CI/CD           | GitHub Actions: lint → typecheck → test → build → deploy (`main`); PR'da Firebase önizleme kanalı |
| Sırlar          | Yalnız Firebase servis hesabı (GitHub Secrets). Koda kişisel veri/maliyet girmez                  |

**Önerilen klasör yapısı**

```
src/
  domain/          pricing/ cart/ vat/ order/ entities/
  application/     ports/ use-cases/ (buildOrderDocument, pharmacistSummary, backup)
  infrastructure/  storage/ (local*Store) image/ (resize) share/ (webShare, clipboard) png/
  presentation/    catalog/ cart/ checkout/ orders/ admin/ parts/ theme/
  composition/     app/ seed/ (başlangıç verisi — maliyetsiz)
```

---

## 10. Riskler ve test senaryoları

### D — Veri ve depolama

| #   | Senaryo                             | Beklenen davranış                                                      |
| --- | ----------------------------------- | ---------------------------------------------------------------------- |
| D1  | İlk açılış, depo boş                | Başlangıç verisi yüklenir; maliyetler "—"                              |
| D2  | Gizli sekme / depo kapalı           | Kırmızı bant "Kaydedilmiyor"; uygulama bellekte çalışır                |
| D3  | Kota doldu (resim)                  | Yükleme reddedilir, mesaj; diğer veri bozulmaz                         |
| D4  | Bozuk JSON / eski şema              | Şema göçü; olmazsa ham veriyi indir + sıfırla seçeneği                 |
| D5  | Tarayıcı verisi silindi             | Veri kaybolur. Önlem: son yedek > 7 gün ise admin uyarısı              |
| D6  | Yanlış / farklı sürüm yedek dosyası | Doğrulama + özet önizleme + onay; reddedilirse mevcut veri aynen kalır |
| D7  | Sepetteki ürün silindi / gizlendi   | Satır düşer + uyarı; geçmiş siparişler etkilenmez                      |
| D8  | Sepet açıkken fiyat değişti         | Sepet güncel fiyatı alır; "fiyat güncellendi" rozeti                   |

### H — Hesap

| #   | Senaryo                                   | Beklenen davranış                                          |
| --- | ----------------------------------------- | ---------------------------------------------------------- |
| H1  | Adet boş / 0 / negatif / ondalık / 99.999 | Yalnız 1–9.999 tam sayı; 0 → satır kalkar                  |
| H2  | Maliyet boş                               | Satış sabit modda; bizim kâr "—"                           |
| H3  | Eczacı marjı < %10                        | Sarı uyarı                                                 |
| H4  | Satış ≥ PSF                               | Kırmızı hata; kayıt onay ister                             |
| H5  | Marj modunda %100 ve üstü                 | Giriş engellenir                                           |
| H6  | "20,5" · "%20" · "1.116,67"               | Abacus `parseNumber` ile doğru okunur                      |
| H7  | Karma KDV oranları                        | KDV oran bazında ayrı satırlar                             |
| H8  | Toplam tutarlılığı                        | Σ satır = toplam, kuruşu kuruşuna (birim test)             |
| H9  | Sepette eczacı % değişikliği              | Yalnız bu sipariş; admin varsayılanı değişmez              |
| H10 | Yuvarlama adımı değişti                   | Hesaplanan fiyatlar yeniden türetilir; sabitler dokunulmaz |

### P — PNG ve paylaşım

| #   | Senaryo                                          | Beklenen davranış                                               |
| --- | ------------------------------------------------ | --------------------------------------------------------------- |
| P1  | Web Share dosya desteklemiyor (PC/eski tarayıcı) | PNG indir + panoya kopyala + WhatsApp Web aç                    |
| P2  | Kullanıcı paylaşımı iptal etti (`AbortError`)    | Sessiz; sipariş "hazır" kalır, sepet silinmez                   |
| P3  | Gönderildiği kesin bilinemez                     | Paylaşım başarılı dönünce "paylaşıldı"; kesin teyit yok (kabul) |
| P4  | WhatsApp görseli sıkıştırır                      | 1080 px, ≥ 28 px yazı; saha testinde okunurluk                  |
| P5  | Font yüklenmeden üretim                          | `document.fonts.ready` beklenir                                 |
| P6  | Eczane adı boş                                   | Paylaş butonu pasif                                             |
| P7  | Aynı sipariş ikinci kez paylaşılıyor             | "Daha önce paylaşıldı" uyarısı; aynı sipariş no                 |
| P8  | Türkçe karakterli dosya adı                      | ASCII dosya adı                                                 |
| P9  | Eczacı kendi telefonuna da istiyor               | Aynı PNG (kazanç yok) veya ayrı özet PNG (açık karar)           |

### W — PWA ve hosting

| #   | Senaryo                                        | Beklenen davranış                                                |
| --- | ---------------------------------------------- | ---------------------------------------------------------------- |
| W1  | Yeni sürüm, tablette eski SW                   | "Yenile" bandı; veri korunur                                     |
| W2  | Çevrimdışı                                     | Açılır, hesaplar, PNG üretir; WhatsApp kendi kuyruğunda bekletir |
| W3  | iOS: ana ekran PWA'sı ile Safari depoları ayrı | Tek giriş yolu; kurulum rehberinde belirtilir                    |
| W4  | Önbellek başlıkları hatalı → eski sürüm takılı | `firebase.json` başlıkları + yayın sonrası kontrol listesi       |

### G — Güvenlik ve gizlilik

| #   | Senaryo                                             | Beklenen davranış                                                            |
| --- | --------------------------------------------------- | ---------------------------------------------------------------------------- |
| G1  | Eczacı ⚙'ye basıp "0" yazar                         | MVP'de kabul edilen risk; küçük simge + otomatik kilit                       |
| G2  | Satış ekranında maliyet sızıntısı                   | Katman kuralı + lint ile imkânsız                                            |
| G3  | Public repo'da kişisel veri                         | Telefon koda girmez / açık karar                                             |
| G4  | Site arama motorunda; sağlık iddiaları herkese açık | `noindex`; katalogda yalnız ambalajdaki ifadeler                             |
| G5  | Maliyetli yedek yanlış yere gönderildi              | "Maliyetler dahil" açık seçim; dosya adında `_MALIYETLI`                     |
| G6  | Public URL'yi başkası açar                          | Kendi cihazında yalnız başlangıç verisini görür; Volkan'ın verisi cihazdadır |

### S — Saha kullanımı

| #   | Senaryo                                     | Beklenen davranış                                    |
| --- | ------------------------------------------- | ---------------------------------------------------- |
| S1  | Sepet yanlışlıkla temizlendi                | Onay + 10 sn "Geri al"                               |
| S2  | Ziyaret yarıda kaldı                        | Sepet + eczane taslağı kalıcı; açılışta devam sorusu |
| S3  | Aynı gün birden çok eczane                  | Paylaşılınca sepet sıfırlanır                        |
| S4  | Tablet döndürüldü                           | Düzen bozulmaz, girilen değer kaybolmaz              |
| S5  | Parlak ortam                                | Açık tema, yüksek kontrast                           |
| S6  | Eczacı araya müşteri alır, ekran kilitlenir | Dönünce aynı ekran ve değerler                       |

---

## 11. Kabul kriterleri

1. Tüm hesap kuralları ve **H** senaryoları testlerle yeşil.
2. Gerçek tablette **C + D** akışı **< 2 dakika**.
3. Depo, PNG'yi telefonda **zoom yapmadan** okuyabiliyor.
4. **Uçak modunda** uygulama açılıyor, sipariş hazırlanıp PNG üretiliyor.
5. Bir cihazda yedek alıp diğerinde yükleyince fiyatlar **birebir** aynı.
6. Satış ekranlarında maliyet **hiçbir yerde** görünmüyor (kod araması + görsel kontrol).
7. Lighthouse PWA kontrolleri geçiyor; ana ekrana eklenebiliyor.

---

## 12. Yol haritası

| Faz   | İçerik                                                                                         | Çıktı                 |
| ----- | ---------------------------------------------------------------------------------------------- | --------------------- |
| **0** | Repo, Vite, TS, ESLint/boundaries, Prettier, Husky, Abacus bağlantısı, Firebase projesi, CI/CD | Boş uygulama canlıda  |
| **1** | Domain: fiyatlama, sepet, KDV, eczacı özeti, sipariş belgesi + tablo testleri                  | Hesap çekirdeği yeşil |
| **2** | Depolama (`local*Store`), başlangıç verisi, şema sürümü, yedek al/yükle                        | Veri katmanı          |
| **3** | Katalog + sepet/hesap arayüzü, yer tutucu görseller                                            | Sunum yapılabilir     |
| **4** | Siparişi tamamla, PNG şablonu, Web Share + yedek yollar, sipariş geçmişi                       | Uçtan uca sipariş     |
| **5** | Admin: ürünler, fiyatlama (tekli/toplu), ayarlar, veri, resim yükleme/küçültme                 | Tam yönetim           |
| **6** | PWA, çevrimdışı, güncelleme bandı, önbellek başlıkları                                         | Sahaya hazır          |
| **7** | Saha testi: Volkan + 2–3 eczane + depo; geri bildirimle düzeltme                               | MVP kabul             |

### MVP sonrası

- Supabase + gerçek kimlik doğrulama, çoklu cihaz senkronu
- PDF ve e-posta gönderimi
- SEM fiyat listesi (müşteri tipi seçimi; PSF × 0,60 kuralı)
- MF (mal fazlası) ve vade
- Raporlama: "bu ay kime ne sattım", ürün bazında satış
- Belge başlığı/tablo şablonunun ihale projesiyle ortak pakete taşınması
- Abacus'a `pricing` motoru talebi (markup/marj/KDV)

---

## 13. Açık kararlar

| #   | Soru                                                            | Etkisi                                     |
| --- | --------------------------------------------------------------- | ------------------------------------------ |
| 1   | Tablet **Android mi iPad mi?**                                  | W3, paylaşım menüsü davranışı, test cihazı |
| 2   | **MF** MVP'ye girsin mi? (satıra "+MF adet")                    | Eczacı kazancı hesabı, PNG sütunu          |
| 3   | Eczacıya ayrı **kazanç özeti PNG'si** olsun mu?                 | P9, ikinci şablon                          |
| 4   | PNG başlığında **Velaris Farma adı/logosu** olacak mı?          | Şablon, marka izni                         |
| 5   | Volkan'ın telefonu **koda varsayılan** mı girsin, admin'den mi? | G3 (public repo)                           |
| 6   | Varsayılan **yuvarlama adımı**: kuruş mu, 1 TL mi?              | Başlangıç satış fiyatları (ör. 1.116,67)   |
| 7   | Varsayılan **KDV oranı** kaç olsun?                             | Tüm toplamlar                              |
| 8   | Repo adı `SNN-Eczane-Siparis` uygun mu?                         | Faz 0                                      |

---

## Ek A — Başlangıç verisi

Kaynak: PSF tablosu. **Satış = PSF ÷ 1,20** (eczacıya %20 markup). **Maliyet koda girmez**; aşağıdaki "Tahmini maliyet" yalnız admin'deki _%40 marjdan tahmin et_ butonunun üreteceği değerdir (maliyet = satış × 0,60). Rakamlar örnektir; kullanıcı değiştirir.

| Aile                    | Varyant                    | Branş                                        |      PSF | Satış (eczane alışı) | Eczacı kârı | Tahmini maliyet |
| ----------------------- | -------------------------- | -------------------------------------------- | -------: | -------------------: | ----------: | --------------: |
| **Gardegen**            | 120 Kapsül                 | Jine-onko, Kadın doğum, Üroloji, Dermatoloji | 3.840,00 |             3.200,00 |      640,00 |        1.920,00 |
|                         | 60 Kapsül                  | 〃                                           | 2.400,00 |             2.000,00 |      400,00 |        1.200,00 |
|                         | Krem %15 Sinekatesin 40 ml | 〃                                           | 1.340,00 |             1.116,67 |      223,33 |          670,00 |
| **Magmeda-6**           | 60 Kapsül                  | Tüm branşlar (ek)                            |   550,00 |               458,33 |       91,67 |          275,00 |
|                         | 90 Kapsül                  | 〃                                           |   750,00 |               625,00 |      125,00 |          375,00 |
| **Silimagen**           | 60 Kapsül                  | Dahiliye, Gastro, Genel cerrahi              |   990,00 |               825,00 |      165,00 |          495,00 |
|                         | 90 Kapsül                  | 〃                                           | 1.250,00 |             1.041,67 |      208,33 |          625,00 |
| **Stomagen**            | Gargara 200 ml             | KBB, Diş hekimi                              |   440,00 |               366,67 |       73,33 |          220,00 |
|                         | Sprey 50 ml                | 〃                                           |   490,00 |               408,33 |       81,67 |          245,00 |
| **Tinagen Complex**     | 30 Kapsül                  | KBB, Nöroloji                                |   650,00 |               541,67 |      108,33 |          325,00 |
| **Vivagen**             | 60 Kapsül                  | Saç ekim merkezi                             |   850,00 |               708,33 |      141,67 |          425,00 |
|                         | Şampuan 350 ml             | 〃                                           |   450,00 |               375,00 |       75,00 |          225,00 |
| **D-Panthenol**         | %9 Sprey 150 ml            | 〃                                           |   320,00 |               266,67 |       53,33 |          160,00 |
| **Ozonlanmış Kantaron** | Zeytinyağı 50 ml           | 〃                                           |   550,00 |               458,33 |       91,67 |          275,00 |

**Aile renkleri (öneri):** Gardegen yeşil · Magmeda-6 mavi · Silimagen hardal/sarı · Stomagen mor/magenta · Tinagen lacivert-bakır · Vivagen yeşil-bakır · D-Panthenol ve Kantaron nötr (yer tutucu).

**Not:** D-Panthenol ve Ozonlanmış Kantaron'un marka ve kutu görseli yok; ayrı aile olarak başlar, istenirse "Saç Ekimi Bakım" grubunda toplanabilir.

---

## Ek B — Mevcut projelerden alınacaklar

**SNN-Ihale-Maliyet-Teklif-Yonetimi**

| Parça                                                                                             | Kullanım                                                             |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `presentation/app/output/CompanyHeader.tsx`                                                       | PNG başlığı (pazarlamacı bilgisi)                                    |
| `presentation/app/output/QuoteSheet.tsx`                                                          | Sipariş formu tablosunun temeli ("Teklif Cetveli" → "Sipariş Formu") |
| `presentation/app/output/print.module.css`                                                        | Belge tipografisi ve tablo stili                                     |
| `domain/abacus/vat/index.ts`                                                                      | `vatOnMinor` — KDV'nin toplam üzerinden bir kez hesaplanması         |
| `domain/basket/lineTotal.ts`                                                                      | "Birim fiyat yuvarlanmaz, toplam bir kez" kararı                     |
| `domain/entities/profitPolicy.ts`                                                                 | Kâr modu adları ve anlamları                                         |
| `application/ports/companyProfileStore.ts` + `infrastructure/storage/localCompanyProfileStore.ts` | localStorage sonuç tipi deseni (`ok` / `unavailable` / `corrupt`)    |
| Klasör yapısı + ESLint boundaries                                                                 | Katman ayrımı                                                        |

**SNN-Abacus-Core ^4.3**

| Motor     | Kullanım                                                            |
| --------- | ------------------------------------------------------------------- |
| `math`    | Tüm fiyat, kâr, KDV hesapları                                       |
| `money`   | `format`, `parseNumber`, `formatGroupedInput`, `toMinor`, `toWords` |
| `text`    | `toAsciiLower` (dosya adı), `whatsapp`, `phone`, `title`            |
| `date`    | Sipariş tarihi biçimi                                               |
| `collate` | Eczane listesinde Türkçe sıralama                                   |
