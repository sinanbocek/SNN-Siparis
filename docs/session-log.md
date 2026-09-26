# Oturum Günlüğü

## 25.09.2026 — MVP kurulumu

- Master plan incelendi; proje sahibiyle kararlar kilitlendi (PRD §0, K1–K22).
- Proje iskeleti ihale düzeninde kuruldu (React 19, Vite 6, TS, boundaries, Abacus strict).
- Domain: fiyat zinciri, 4 kâr modu, MF (katlanarak), sepet toplamı, KDV grupları, eczacı
  kazancı, sipariş anlık görüntüsü. Beklenen değerler PRD Ek A tablosundan.
- Arayüz: katalog (kart/liste), sepet + kazanç paneli, tamamla + PNG, siparişler, yönetim.
- PWA, simgeler, başlangıç görselleri (600 px WebP).
- Tarayıcıda denendi: sepet toplamları ve sipariş resmi metni doğru; telefon düzeni doğru.
  PNG üretimi tarayıcı bölmesi gizli olduğu için yerelde denenemedi; canlıda denenecek.

**Sırada:** saha testi (Volkan + 2–3 eczane + depo), gerçek tablette < 2 dk akış ölçümü.

## 25.09.2026 — arayüz revizyonu (v0.2.0)

- Proje sahibi geri bildirimi: tipografi, ihale görsel dili, ₺ biçimi, tarih biçimi, liste katalog,
  görsel penceresi, sipariş sil/düzenle, şifre, yönetim rengi, telefonda taşma.
- Aile standartları okundu (eş zamanlı çalışma, giriş alanları, kod dili, kontrol listesi).
  İlk kurulumda ana dala doğrudan commit atılmıştı; bu iş `feat/ui-revision` dalında, PR ile.
- Para kutusu standardı: sabotaj denemesi yapıldı (`dotAsDecimal` geri konunca 7 test kırmızı).
- Ölçüm (375×812 ve 1180×820): tüm ekranlarda sayfa genişliği pencereye eşit, yatay taşma yok.
- SNN-Standartlar PR #109 (aile listesi) arka plan ajanıyla yeşile getirildi, birleştirilmedi.

## 25.09.2026 — revizyon 2 (v0.3.0)

- Proje sahibi: amber yok, "ürün grubu", renk seçici yok, iki yönlü fiyat, "Perakende Satış
  Fiyatı", boşluk hatası, giriş kutuları (GHS-Panel standardı), koyu tam genişlik gezinme,
  MF etiketi; araya giren istek: standart onay penceresi + bildirim sistemi.
- Boşluk hatasının sebebi: kutular kırpılmış sipariş özetinden besleniyordu; ham taslağa bağlandı.
- Giriş kutusu kuralı GHS-Panel `src/utils/moneyInput.ts`'ten alındı (testleri de uyarlandı).
- Lint kapısı: `window.confirm/alert/prompt` yasak; sabotaj denemesinde 2 kullanım yakalandı.
- Ölçüm (375×812 çerçevede): katalog, sepet, siparişlerde taşma yok; alt gezinme tam genişlik.
- SNN-Standartlar #110 başka oturumda birleşti; #109 açık, proje sahibinin onayını bekliyor.

## 25.09.2026 — raporlar (v0.4.0)

- Proje sahibi: yönetici için premium istatistik/rapor sayfası. Firebase şimdilik yok, MVP.
- Arada iki düzeltme ayrı PR ile yayınlandı (v0.3.2): pencere sürüklemede kapanıyordu;
  "Benim Alışım" / "Eczaneye Satışım" tanımları.
- Başka oturum açık göründüğü için iş ayrı worktree'de (`../SNN-Siparis-reports`) yapıldı.
- Grafikler kütüphanesiz SVG; dataviz kuralları (tek eksen, ≤24 px sütun, 2 px boşluk,
  seçici etiket, fareyle ayrıntı). Amber yok: sıralamalar tek renk.
- Ölçüm: 375 px çerçevede beş dönemde de taşma yok; 1280 px masaüstü ekran görüntüsüyle kontrol.

## 25.09.2026 — dokunuş kalitesi ve doğruluk (v0.4.1)

- Arka plan ajanıyla UI/UX araştırması (60+ bulgu, 40+ kaynak); kod incelemesi + SWOT.
- Yapılan: araştırma P1'lerinden satış ekranı dokunuş kalitesi; incelemedeki iki doğruluk hatası.
- Tipografi: araştırma gövdeyi 16 px öneriyor, proje sahibi daha önce "yazılar büyük" dedi;
  gövde 14 px kaldı, yalnız 13 px altı yazılar 13 px'e çıkarıldı. Karar proje sahibinde.
- Sabotaj denemeleri: numara testi eski davranışta kırmızı.
- Ayarlar ekranı yeniden tasarım taslağı çizildi; proje sahibi onayı bekleniyor.

## 26.09.2026 — mola, yarın devam

**Kararlar (proje sahibi):**

- 1a — gövde yazısı 14 px kalır (araştırmanın 16 px önerisi uygulanmaz).
- 2a — Ayarlar ekranı taslağı olduğu gibi uygulanacak: 4 bölüm (Pazarlamacı, Sipariş resmi, Fiyat
  varsayılanları, Güvenlik ve uygulama); tablette açıklamalı iki sütun, telefonda gruplu liste;
  metin ayarları otomatik kayıt + "✓ Kaydedildi"; fiyat ayarları taslakta bekler, etki özeti
  ("N ürünün fiyatı değişecek", örnek önce → sonra), Kaydet / Vazgeç, 10 sn Geri al; yuvarlama
  4 seçenekli düğme; boş KDV eski değere döner + açıklama; uyarı rengi menekşe.

**Sıradaki iş:** Ayarlar yeniden tasarımı (2a). Kaynak: UI/UX araştırma raporu §6 (oturum
scratchpad'inde `ui-ux-arastirma.md`; kalıcı değil, gerekirse yeniden üretilir).

**Açık kalanlar:** araştırmanın diğer P1/P2 maddeleri (toplu fiyat işleminde seçim yokken onay,
klavye odak halkası, kontrast düzeltmeleri, uyarı rengi menekşe); kod incelemesinden görsel
eşlemesinin `data:image`/`/products` ile sınırlanması ve PNG'de yıl; saha testi (gerçek cihazda
WhatsApp PNG hiç denenmedi).

## 26.09.2026 — Ayarlar yeniden tasarımı (v0.5.0)

- Karar 2a uygulandı (PRD K40). Etki özeti `application/admin/settingsImpact.ts`: özet ile kayıt
  aynı `rederiveSales` / `variantPsf` yolundan gider.
- Fiyat ayarı + katalog `writeAllOrNothing` ile birlikte yazılır; Geri al aynı yoldan.
- `UpdateSignal` sürüm ve `check()` taşıyor (Ayarlar › Güncellemeleri denetle).
- Ölçüm: 375 / 800 / 1180 px'te yatay taşma yok; telefonda Kaydet çubuğu alt gezinmenin üstünde.
- Sıradaki: kod incelemesinden iki küçük düzeltme (görsel eşlemesi, PNG'de yıl), sonra
  araştırmanın kalan P1/P2 maddeleri.
