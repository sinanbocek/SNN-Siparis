# ADR-0002 — Maliyet yalnız yönetim tarafında

**Durum:** Kabul · 25.09.2026

**Karar:** Maliyet ve bizim kâr `src/domain/costs` ve `src/application/admin` altında yaşar.
`presentation/sales` ve `presentation/parts` bunları import edemez (boundaries `error`). Katalog
kaydında maliyet alanı yoktur. Maliyet ayrı `snn-siparis.costs` anahtarındadır ve yalnız yönetim
kilidi açıkken okunur. Yönetim kodu ayrı parça olarak tembel yüklenir.

**Zorlama:** ESLint boundaries · CI "Cost leak guard" · `App.test.tsx` maliyet sızıntısı testi.
