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
