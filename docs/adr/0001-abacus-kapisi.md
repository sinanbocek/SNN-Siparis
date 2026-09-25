# ADR-0001 — Tüm hesap ve biçim SNN-Abacus-Core ile

**Durum:** Kabul · 25.09.2026

**Karar:** Tutarlar kuruş cinsinden tam sayıdır. Toplama, çarpma, bölme, yuvarlama ve para, yüzde,
tarih biçimi yalnız `@snn/abacus-core` ile yapılır. Ham `Math.*`, `parseFloat`, `Intl`, `toFixed`,
`toLocale*`, `?? 0` ve elle `₺`/`TL` ekleme ESLint ile yasaktır (çekirdeğin `strict` kapıları ve
yerel kapılar).

**Gerekçe:** Aile standardı; float kuruş kaybı ve sessiz sıfır hataları.

**Not:** KDV oranı, kâr modu, PSF ve MF kuralları çekirdekte yoktur. Bunlar bu uygulamaya özgü
kurallar olarak `src/domain` altında, her işlemi çekirdeğe yaptırarak yazıldı (proje sahibi onayı,
25.09.2026). Genel olanlar ileride çekirdeğe talep edilebilir.
