# CLAUDE.md

Bu projede çalışan her AI asistanı için giriş noktası.

## Oturum başı (sırayla)

1. `AI-RULES.md` — bağlayıcı ortak anayasa (tamamı)
2. `PRD.md` — gereksinimler; §0 karar kaydı her şeyin önüne geçer
3. `ARCHITECTURE.md` — katmanlar, dizinler, bağımlılık tablosu
4. `docs/adr/` — kilitli kararlar
5. `docs/session-log.md` — nerede kalındı
6. `git status` + `npm run build` + `npm test` — temiz ve yeşil mi
7. Kısa durum raporu, sonra iş

## Oturum sonu

1. `npm run build` ve `npm test` tam çıktısı (kanıt)
2. `docs/session-log.md` güncelle; gerekiyorsa `docs/teknik-borc.md`, `docs/adr/`,
   `ARCHITECTURE.md`, `CHANGELOG.md`
3. Commit `docs/commit-conventions.md` biçiminde; push ve yayın proje sahibinin onayıyla

## Komutlar

```bash
npm run build
```

```bash
npm test
```

```bash
npm run deploy
```

- `npm run build` — lint + tip kontrolü + vite build
- `npm run deploy` — build + test + `firebase deploy --only hosting` (elle yayın, ADR-0004)

## Asla

- Satış ekranlarına (`presentation/sales`, `presentation/parts`) maliyet sokmak (ADR-0002)
- Gerçek telefon numarası ya da müşteri verisini koda/belgeye yazmak (ADR-0003)
- `@snn/abacus-core`'daki bir hesabı burada yeniden yazmak; ham `Math.*` (ADR-0001)
- `null`'ı `0`'a çevirmek; ESLint kuralını gevşetmek; testi koda uydurmak
