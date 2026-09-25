# ADR-0004 — Firebase'e elle yayın

**Durum:** Kabul · 25.09.2026

**Karar:** GitHub Actions yayın yapmaz; yalnız doğrular (lint, tip, biçim, test, derleme, grep
kapıları). Yayın bilgisayardan `npm run deploy` ile yapılır. GitHub'da Firebase anahtarı tutulmaz.

**Gerekçe:** Proje sahibi kararı; ihale projesiyle aynı yol; sır yönetimi gerekmez.
