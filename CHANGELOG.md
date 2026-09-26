# Değişiklik Günlüğü

## 0.5.0 — 26.09.2026

Ayarlar ekranı yeniden tasarlandı (karar 2a).

- Dört bölüm: Pazarlamacı, Sipariş resmi, Fiyat varsayılanları, Güvenlik ve uygulama;
  tablette açıklamalı iki sütun, telefonda gruplu liste
- Ad, telefon, başlık ve önek kendiliğinden kaydedilir; "✓ Kaydedildi" izi, hata olursa kırmızı satır
- Sipariş resmi önizlemesi: başlık ve örnek numara; önek büyük harfe çevrilir, silinen karakter söylenir
- Fiyat ayarları (KDV, eczacı kârı, yuvarlama) taslakta bekler: "N ürünün fiyatı değişecek",
  örnek önce → sonra; Kaydet ya hep ya hiç, ardından 10 sn "Geri al"
- Yuvarlama dört seçenekli düğme (Kuruş · 1 TL · 5 TL · 10 TL)
- Boş bırakılan KDV ya da eczacı kârı eski değere döner ve açıklama çıkar
- Şimdi kilitle, sürüm numarası ve "Güncellemeleri denetle"; yönetim şeridindeki "Kilitle"
  düğmesi kaldırıldı (aynı iş Ayarlar'da)
- Uyarı rengi menekşe; geliştirici notu kaldırıldı
- Fiyatlama → **Toplu fiyat değişikliği** kartı: Artır/Azalt, %/TL, tek tutar; Önizle
  ("N ürünün fiyatı %10 düşecek", örnek önce → sonra), Uygula; seçim yoksa onay; 10 sn Geri al.
  İndirim artık yapılabiliyor; sıfırın altına düşecek ürün atlanır ve söylenir
- Alış tahmini ayrı satırda, yalnız alışı boş ürün varsa görünür; Geri al'lı
- Yönetim şeridindeki "Yönetim" etiketi kaldırıldı
- Ürün fiyat penceresi yeniden: üstte hep görünen fiyat zinciri (Alış → Eczaneye Satışım → PSF,
  bizim kâr ve eczacı kârı tutar + yüzde); "Elle yazarım / Alışımdan hesapla" ve "% ekle / % marj /
  TL ekle" düğmeleri; Perakende Satış Fiyatı "Eczacı oranından / Elle yazarım"; MF tek cümle;
  KDV kapalı satırda; Vazgeç / Kaydet altta sabit

## 0.4.1 — 25.09.2026

Satış ekranı dokunuş kalitesi ve iki doğruluk düzeltmesi (kod incelemesi + UI/UX araştırması).

- Dokunma hedefleri 44 px (kutu, düğme, adet düğmesi, pencere kapatma); onay kutusu 20 px
- Adet ve tutar kutusuna dokununca mevcut sayı seçilir ("1" yanına "2" → "12" olmaz)
- Sepetten çıkan ürün (adet 0) için 10 sn "Geri al" bildirimi
- Dikey tablette (≤ 860 px) eczacı kazanç şeridi görünür
- 13 px altı yazı kalmadı (grafik eksenleri 12 px); kutu yazısı iPad dikeyde de 16 px
- Telefonda katalog satırı: ad ve adet üstte, fiyatlar altta tam genişlik
- Düzeltme: silinen siparişin numarası yeniden verilmez (son verilen numara cihazda saklanır)
- Düzeltme: yedek yükleme ya hep ya hiç; hata olursa mevcut veri korunur, "yüklendi" denmez

## 0.4.0 — 25.09.2026

- Yönetim → **Raporlar**: dönem seçimi ve önceki döneme göre değişim; ciro, kâr ve marj,
  sipariş ve ortalama, kutu ve MF; ciro-kâr sütun grafiği (fareyle ayrıntı); en çok satanlar
  (ciro / kâr / adet); ürün grupları; eczaneler; otomatik "öne çıkanlar"
- Kâr bugünkü alış fiyatıyla; MF kutuların alışı kârdan düşer; alışı girilmemiş ciro ayrı
- "Örnek veriyle göster" önizlemesi (kaydedilmez)
- Sıfır tutar her yerde "₺0,00"

## 0.3.2 — 25.09.2026

- Pencereler: kutuda basılı tutup dışarı sürükleyince pencere kapanıyordu; artık yalnız arka plana basıp bırakınca kapanır
- Tanımlar: "Maliyet" → "Benim Alışım", "Satış fiyatı" → "Eczaneye Satışım" (fiyatlama, kâr modu, yedek ekranı)

## 0.3.1 — 25.09.2026

- "Son yedek 7 günden eski" uyarısı kaldırıldı (yönetim üstü ve Veri sekmesi)

## 0.3.0 — 25.09.2026

Revizyon 2 (proje sahibi geri bildirimi).

- Ortak onay penceresi ve bildirim sistemi (`useFeedback`); tarayıcı `confirm/alert` lint ile yasak
- Sepette perakende satış fiyatı yazılabilir; eczacı kârı fiyattan geri hesaplanır (iki yönlü)
- Tutar ve oran kutuları GHS-Panel standardında; telefon kutuları yalnız rakam; sipariş resminde
  telefon "+90 (5xx) …" biçiminde
- Eczane adı ve not kutusunda boşluk yazılamama hatası düzeltildi
- "Aile" yerine "Ürün grubu"; renk seçici kaldırıldı; amber rengi kaldırıldı
- "PSF" yerine metinlerde "Perakende Satış Fiyatı"
- Koyu üst şerit; telefonda tam genişlik koyu alt gezinme; adet ve MF kutularına etiket

## 0.2.0 — 25.09.2026

Arayüz revizyonu (proje sahibi geri bildirimi).

- Görsel dil SNN-Ihale ile aynı: 14 px yazı, ihale düğme/kutu/kart/sekme stilleri, beyaz üst şerit
- Para her yerde ABACUS biçiminde (`₺2.000,00`); tarih "25 Eyl. 20:09" / "24 Ara. 2025"
- Katalog yalnız liste; ürün adı üstte, çeşit altta; görsele dokununca büyük görsel penceresi
- Siparişler: silme ve düzenleme (aynı numara, paylaşınca kayıt güncellenir)
- Yönetim: turuncu bant kaldırıldı; şifre kendiliğinden denenir, telefonda rakam klavyesi
- Telefonda yatay kaydırma yok: fiyatlama ve ürün tabloları kart düzenine geçer
- Para kutusu aile giriş standardına uyduruldu (belirsiz "98.5" reddedilir; "₺1.234" doğru okunur);
  adet kutuları `text.digits`
- Kod dili taraması: 11 bulgu → 0

## 0.1.0 — 25.09.2026

İlk MVP.

- Katalog: kart ↔ liste, arama, doğrudan adet girişi, kutu görselleri ve yer tutucular
- Sepet: KDV hariç/KDV/genel toplam, eczacı kazancı paneli, sepete özel eczacı oranı,
  satıra özel oran, MF (kural + elle), telefonda kazanç şeridi, temizle + geri al
- Siparişi tamamla: eczane formu, canlı önizleme, WhatsApp paylaşımı (Web Share) ve bilgisayar
  için indir + kopyala + WhatsApp Web
- Siparişler: süzgeç, arama, yeniden paylaş, yeni sepete kopyala
- Yönetim (şifre perdesi, 5 dk kilit): fiyatlama (4 kâr modu, toplu değişiklik, %40 tahmin,
  uyarılar), ürünler (aile/çeşit, sıralama, görsel yükleme), ayarlar, veri (yedek al/yükle,
  sıfırla)
- PWA: ana ekrana ekleme, çevrimdışı açılış, "Yeni sürüm hazır" bandı
