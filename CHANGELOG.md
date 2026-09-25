# Değişiklik Günlüğü

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
