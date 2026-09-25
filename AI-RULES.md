# AI-RULES.md — Ortak Geliştirme Anayasası

> **Bu dosya bağlayıcıdır.** Kod yazmadan, dosya oluşturmadan/silmeden veya komut çalıştırmadan
> önce bu dosyanın tamamı okunur ve kabul edilir. Kural ile bir istek çelişirse **DUR ve proje
> sahibine (Sinan) sor** — kuralı sessizce esnetme. Bu dosya tüm projelerde **aynıdır**; projeye
> özgü ayrıntılar `PROJECT-NOTES.md`'dedir ve bu dosyayı gevşetemez.

**Sürüm:** 2.0 · **Geçerlilik:** Claude, Gemini ve tüm AI asistanları · **Kod dili:** İngilizce

**Uygulanabilirlik etiketleri:**
`[TÜM]` her projede · `[BACKEND]` sunucu/veritabanı varsa · `[SUPABASE]` Supabase kullanılıyorsa

---

## 0. AI'a Talimat (önce oku)

1. İş başlamadan önce: bu dosyayı + varsa `PROJECT-NOTES.md`'yi + varsa şema dosyasını oku.
2. **Kuralı geçmek için kuralı gevşetme.** Lint/tip hatası çıkıyorsa kodu düzelt; `disable`, `any`, `@ts-ignore` ile kaçma; testi implementasyona uydurma.
3. Sütun/alan adı **tahmin edilmez**, kaynaktan okunur.
4. Onaysız dosya operasyonu yok; proje klasörü dışına çıkma yok.
5. Bir hatada **3 denemede** çözemezsen dur, durumu özetle, sor.
6. Her iş sonunda `lint + build + test` çıktısını kanıt olarak sun.

---

## 1. Temel İlke: Her Kuralın Bir Makine Zorlaması Vardır `[TÜM]`

Yazılı kural yetmez — geçmişte bu hatalar yazılı kurala rağmen yapıldı. **Her katı kuralın bir
otomatik zorlayıcısı olmalı** (ESLint `error`, `tsc`, husky pre-commit, CI kapısı, DB constraint).
Zorlanamayan madde "kural" değil "öneri"dir ve öyle işaretlenir.

- ESLint kuralları **`warn` değil `error`**. `warn` = "geçti" değildir.
- `npm run build` **önce lint + tip kontrolü** çalıştırır; ihlalde build kırılır.
- Commit öncesi husky `pre-commit` → `tsc --noEmit` + `lint-staged`.
- Mümkünse CI: `install → lint → typecheck → build → test`.

---

## 2. Mimari: Temiz Katmanlar, Build-Kıran Sınırlar `[TÜM]`

Bağımlılık tek yönlüdür ve **`eslint-plugin-boundaries` ile build zamanında zorlanır**:

```
presentation → application → domain ← infrastructure
                    ▲                        │
                    └──────── composition ───┘
```

- `domain/` **hiçbir dış kütüphaneye** bağımlı olamaz. Tek istisna: `domain/abacus/` içindeki `decimal.js`.
- `presentation` katmanı `infrastructure`'ı ve ABACUS hesap motorlarını import **edemez**; yalnız `application` çıktısını ve ABACUS'ın biçim (money/date/text) çıkışını kullanır.
- `services`/`repository` katmanı `components`/`pages` import etmez.
- İş mantığı domain/use-case'te durur, component'te değil.
- İhlal → ESLint `error` → build kırılır. Kural gevşetilmez, kod düzeltilir.

---

## 3. ABACUS: Merkezî Hesap ve Biçim Otoritesi `[TÜM]`

**İlke:** Tüm matematik, para çevrimi, para/sayı/tarih biçimleri, metin normalizasyonu ve imla
**yalnızca ABACUS üzerinden** yapılır. Aynı iş için ikinci bir fonksiyon yazılmaz.
Tek otorite = tek doğruluk kaynağı = hatayı tek yerde arama.

> Bu bölüm, üç projedeki (Portföy, Nakit Akış, Yönetici Özeti) gerçek ABACUS uygulamalarının
> karşılaştırmasından damıtılmıştır. Kararlar kanıta dayalıdır.

### 3.1 Nerede yaşar

`src/domain/abacus/` (en iç katman). Her motor kendi klasöründe:
`src/domain/abacus/<motor>/index.ts` + `<motor>/<motor>.test.ts`.
`lib/` altında **değil** — ABACUS saf mantıktır, I/O yapmaz.

### 3.2 Çağrı deseni: tiplenmiş, kısa, tek kapı

- **String dispatch (`process({type,payload})`) YASAK.** Denendi; tip güvenliğini yok etti, her yerde `cast` ve `|| varsayılan` yarattı.
- **Doğru desen:** tiplenmiş barrel namespace. Barrel (`src/domain/abacus/index.ts`) her motoru namespace olarak dışa açar:
  ```ts
  export * as math from "./math";
  export * as money from "./money";
  export * as currency from "./currency";
  export * as date from "./date";
  export * as text from "./text";
  ```
- **Çağrı böyle görünür (kısa, İngilizce):**
  ```ts
  import { math, money, currency, date } from "@/domain/abacus";

  money.format(105000); // "1.050,00 ₺"
  math.add(a, b);
  currency.convert(amountMinor, rate);
  date.format(iso, "long");
  ```
- Çağıran taraf hangi alt motorun çalıştığını bilmek zorunda değil; her şey `abacus` kapısından geçer, dışarıda kimse hesap/format yapmaz (§3.8 ile zorlanır). Senin "ham veri → ABACUS → alt motor → çıkış" modelin böyle korunur; fazladan router yoktur.

### 3.3 Çekirdek motorlar (her projede zorunlu iskelet)

| Motor                       | Sorumluluk                                                                                                        | Örnek çağrı                                            |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `math`                      | Aritmetik, yuvarlama, oran, yüzde — **`decimal.js` ile**. Sayı **hesaplar** (sonuç `number`/`Decimal`/`null`).    | `math.add`, `math.ratio`, `math.percent`, `math.round` |
| `money`                     | Para/sayı/yüzde/oran **gösterimi** (sonuç `string`). Muhasebe parantezli negatif `(1.210,50)`, `0` ≠ yokluk `—`.  | `money.format`, `money.percent`, `money.parseInput`    |
| `currency`                  | Para birimi **çevrimi** (tutar × kur, çapraz kur). Kuru **asla kendi çekmez/uydurmaz**; kur dışarıdan verilir.    | `currency.convert`, `currency.cross`                   |
| `date`                      | Takvim tarihi biçimleme + gün aritmetiği + göreli ifade. `new Date().toLocale*` bunun yerine geçmez.              | `date.format`, `date.daysBetween`, `date.relative`     |
| `text`                      | Türkçe metin normalizasyonu (İKN, telefon, e-posta, web, unvan, ürün adı) + enum→etiket çevirisi + TR title-case. | `text.normalizePhone`, `text.label`, `text.titleCase`  |
| `orthography` _(opsiyonel)_ | Türkçe ek uyumu ('de/'da, ki). Gerekmiyorsa hiç eklenmez.                                                         | `text.suffix`                                          |

**Ayrım kuralı:** hesap `math`'te (sonuç sayı), gösterim `money`'de (sonuç metin). Örn. yüzdeyi
`math.percent` hesaplar, `money.percent` biçimler. İkisi karışmaz.

### 3.4 Projeye özel motorlar

Portföy'ün `valuation`/`trading`/`psychology`'si, Nakit'in `bid`/`capitalCost`/`dataQuality`'si gibi
alana özel motorlar **aynı ağaç ve aynı sözleşmeyle** eklenir (`src/domain/abacus/<motor>/`, barrel'a
namespace olarak, tiplenmiş, decimal.js ile, I/O'suz). Master bunları isimle saymaz; "çekirdekle aynı
kurallara uyan uzantı" sayar.

### 3.5 Para

- Para **her zaman kuruş bazlı tam sayı** (`number`/DB'de `BIGINT`). Ondalıklı float ile para **yasak**.
- Tüm para aritmetiği `math` içinde **`decimal.js`** ile. Toplama gibi tam-sayı işlemler düz yapılabilir; bölme/oran/yüzde **daima** decimal.js.
- **Yuvarlama tek kip:** half-up, Türkiye usulü (`2,49 → 2`, `2,50 → 3`), işaret korumalı. Her yerde aynı. (Ayrıntı: `ABACUS-SPEC.md`.)

### 3.6 Hata davranışı

- ABACUS fonksiyonları tiplenmiş değer veya **`null`** döner (hesaplanamıyorsa `null`).
- **`0` (gerçek sıfır) ile yokluk (`—`) ayrılır.** Sıfır `"0"`, veri yoksa `"—"`. Asla uydurma varsayılan.
- **Çağrı tarafında `|| 0` / `|| "0 ₺"` gibi sessiz varsayılan YASAK.** `null` gelirse `—` gösterilir, uydurulmaz.
- `{ success, data, error }` zarfı **API/RPC/Edge sınırı içindir** (§6), saf ABACUS fonksiyonuna dayatılmaz.

### 3.7 I/O yok — veri enjekte edilir

ABACUS hiçbir yerden veri **çekmez**: fetch yok, DB yok, `localStorage` yok, `import.meta.env` yok.
Kur, faiz, sabitler dahil tüm dış veri **parametre olarak** girer. (Kur zinciri
`infrastructure`'da toplanır, ABACUS'a sayı olarak verilir.)

### 3.8 Dışarıda yasaklar + zorlama

`abacus/` **dışında** şunlar yasaktır ve **ESLint ile zorlanır**:
`Intl.NumberFormat`, `Intl.DateTimeFormat`, `.toLocaleString/.toLocaleDateString/.toLocaleTimeString`,
`.toFixed()`, `parseFloat()` ile para/oran hesabı, elle string ile para/tarih üretmek.

Üç zorlama birlikte kurulur (üç projede de kural bu yüzden çöktü — yazıldı ama zorlanmadı):

1. **boundaries** → `presentation` hesap motorlarını (`math`/`currency`) import edemez.
2. **`no-restricted-syntax` / `no-restricted-properties`** → yukarıdaki API'ler `abacus/` dışında `error`.
3. **CI grep guard** → `src/presentation/` içinde `toFixed|Intl|toLocale|Decimal|parseFloat` taraması **sıfır** olmalı; ihlalde CI kırılır (sessizce geri gelmesin diye otomatik).

### 3.9 Hedef: ortak `@snn/abacus` paketi

Çekirdek motorlar (`math`, `money`, `currency`, `date`, `text`) tüm projelerde **birebir aynı**
olacağından, uzun vadede tek bir workspace paketine (`@snn/abacus`) çıkarılır ve her repo oradan
import eder — böylece çekirdek gerçekten tek kaynaktan gelir. Projeye özel motorlar her repoda kalır.
(Yeni projelerde doğrudan bu paketle başla; mevcutlar §14 ile zamanla buraya taşınır.)

### 3.10 Backend paritesi `[SUPABASE]`

Aynı hesap hem TS hem SQL'de gerekiyorsa (ör. portföy değerleme), **tek kaynak** hedeflenir; mümkün
değilse ikisi arasındaki fark açık teknik borç olarak `PROJECT-NOTES.md`'ye yazılır ve bir senkron
kontrolü (test/script) eklenir. Sessiz ikiz implementasyon yasak.

---

## 4. Sayısal Hassasiyet `[BACKEND]`

Para `NUMERIC(18,2)`, birim fiyat/kur `NUMERIC(14,6)`, miktar `NUMERIC(14,4)`, oran `NUMERIC(8,4)`,
makro `NUMERIC(14,2)`. Sınırsız `numeric` yasak. Kur/veri yoksa işlem **durur** — sabit kur fallback
(`|| 35`) ve sessiz `|| 0` yasak (§3.6 ile aynı ilke).

---

## 5. Tip Güvenliği `[TÜM]`

- TypeScript **her zaman** `strict: true` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`. `strict: false` yasak.
- `any` yasak; `@ts-ignore`/`@ts-expect-error` ile kaçış yasak.
- Magic number/string yasak → sabit dosyasına al.
- Fonksiyon ≤ ~50–60 satır; dosya makul (component ~150, hook ~100, use-case ~80, motor ~200; sert sınır ~250).

---

## 6. Hata Yönetimi `[TÜM]`

- Servis/repo/RPC/Edge dönüşleri **`{ success, data, error }`**.
- Tüm `async` fonksiyonlar `try-catch`. Teknik DB hataları UI'a **sızmaz**; kullanıcıya Türkçe mesaj.
- `console.log` üretimde yasak (`warn`/`error` serbest).
- Riskli her widget `<ErrorBoundary>` ile sarılır.

---

## 7. Veritabanı ve Şema `[SUPABASE]`

- **Migration'lar tek doğruluk kaynağıdır.** GUI'den manuel şema değişikliği yasak — her şey `supabase/migrations/` ile.
- Yeni tablo = **CREATE → GRANT → RLS**:
  ```sql
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.<tablo> TO authenticated;
  GRANT ALL ON public.<tablo> TO service_role;   -- anon'a GRANT verilmez
  ```
- DDL sonrası `NOTIFY pgrst, 'reload schema';`.
- **Şema dokümanı migration ile AYNI commit'te** güncellenir. Sütun adı bu dokümandan okunur, tahmin edilmez. Çelişkide **migration doğrudur**.
- `SECURITY DEFINER` içinde tenant/yetki kontrolü şarttır.

---

## 8. Sır Yönetimi `[TÜM]` — sıfır tolerans

- **Hiçbir izlenen dosyada gizli anahtar bulunmaz:** kaynak kod, `.env.example`, CI/workflow, `codemagic.yaml`, `*.json` config. Örneklerde yalnız **placeholder**.
- Sırlar yalnız gitignore'lu `.env` / platform secret store'da.
- Repoya (git history dahil) sır girdiyse: **iptal → yenile → secret store'a taşı.** Service account private key en yüksek öncelik.
- Zorlama: pre-commit sır taraması (`gitleaks`/regex) + `.gitignore` denetimi.

---

## 9. Test: Kırmızı-Önce TDD `[TÜM]`

- Test **implementasyondan önce** yazılır; **önce kırmızı** görülür; sonra yeşile kodlanır.
- Testler **gerçek belge/veri değerlerinden** yazılır; **asla implementasyon çıktısına uydurulmaz**.
- Onaylanan test implementasyon sırasında değiştirilmez.
- Sahte test yasak (`expect(true).toBe(true)`, uydurma mock).
- Formül/hesap içeren her modül (`math`, `currency`, motorlar) için test zorunlu.

---

## 10. Dil ve İsimlendirme `[TÜM]`

- **UI metinleri, mesajlar, dokümanlar, commit açıklamaları: Türkçe.**
- **Kod (değişken/fonksiyon/tip/sınıf, ABACUS motorları ve fonksiyonları dahil): İngilizce.** Sektör standardı.
- PostgreSQL `snake_case` (tablo çoğul, sütun tekil). TS `camelCase`, sabit `UPPER_SNAKE_CASE`, boolean `is/has/should`. Tip/interface `PascalCase` ("I" öneki yok). Component `PascalCase.tsx`, hook/servis `camelCase.ts`, klasör `kebab-case`.
- DB `snake_case` → UI `camelCase` dönüşümü repository/mapper katmanında.
- **Kod dili:** Tanımlayıcılar İngilizce, belgeler ve yorumlar Türkçe.
  Kural: `SNN-Standartlar/standartlar/kod-dili-standardi.md` (aile standardı).
  Yukarıdaki maddeler bu standardın bu projedeki ayrıntısıdır; çelişki görülürse aile
  standardı geçerlidir ve iş durup proje sahibine sorulur.
- **Zorlama (turnike) takılı (2026-09-19).** `.github/workflows/kod-dili.yml` her PR'da ve
  `main`'e her gönderimde YALNIZ eklenen satırlarda Türkçe tanımlayıcı arar; yorum, dizge ve
  belgeler taranmaz. 2026-09-18'de yanlış alarmlar nedeniyle ertelenmişti; SNN-Standartlar
  kök nedeni düzeltip 5 gerileme testi ekledi (11 projede 29 yanlış alarm düştü, gerçek bulgu
  kaybolmadı), bu yüzden kapı kuruldu. Türkiye'ye özgü kavram için istisna: proje kökünde
  `.snn-kod-dili.json`, gerekçe zorunlu.

---

## 11. Süreç `[TÜM]`

- Kodlamadan önce görev dosyası güncellenir; tek odak, madde bitmeden diğerine geçilmez.
- Önemli değişiklikte oturum günlüğü güncellenir.
- Sürüm artışında `CHANGELOG.md` güncellenir (semantik versiyonlama).
- Push/deploy öncesi doğru proje/hesap doğrulanır; onay proje sahibindedir.

---

## 12. Zorlama Haritası (rule → mekanizma)

| Kural                                      | Zorlayan mekanizma                                         | Yeri                   |
| ------------------------------------------ | ---------------------------------------------------------- | ---------------------- |
| Katman sınırları (§2)                      | ESLint `boundaries/*` (error)                              | `eslint.config.*`      |
| ABACUS dışı format/hesap yasağı (§3.8)     | ESLint `no-restricted-properties/syntax` (error) + CI grep | `eslint.config.*` + CI |
| ABACUS tek kapı (§3.2)                     | boundaries + barrel; presentation yalnız `money/date/text` | `eslint.config.*`      |
| `strict`, `any`, tip (§5)                  | `tsc --noEmit` + typescript-eslint                         | `tsconfig.json`        |
| Para = kuruş int / float yasağı (§3.5, §4) | ESLint restrict + inceleme                                 | `eslint.config.*`      |
| `{success,data,error}` (§6)                | tip sözleşmesi                                             | `types/common.ts`      |
| CREATE→GRANT→RLS (§7)                      | migration şablonu + inceleme                               | `supabase/migrations/` |
| Sır sızıntısı (§8)                         | pre-commit tarama + `.gitignore`                           | husky + `gitleaks`     |
| Kırmızı-önce test (§9)                     | test + `build` test kapısı                                 | CI / `npm run build`   |
| Lint/build kapısı (§1)                     | `build` = lint && tsc && vite build                        | `package.json`         |

---

## 13. Asla Yapılmayacaklar (özet)

- UI'da hesap/format; ABACUS'ı atlamak; aynı iş için ikinci fonksiyon.
- Para'yı float ile tutmak; sabit kur / sessiz `|| 0` fallback.
- ABACUS'ta string dispatch router; `payload: unknown`.
- `strict: false`; `any`/`@ts-ignore` ile kaçmak.
- `domain`'e dış kütüphane sokmak; sınırı delmek için ESLint'i kapatmak.
- Gizli anahtarı koda/repoya yazmak; sızmış anahtarı iptal etmeden bırakmak.
- Manuel şema değişikliği; RLS/GRANT'sız tablo; `anon`'a yetki; şema dokümanını güncellememek.
- Onaylanmış testi koda uydurmak; sahte test.
- Onay almadan push/deploy; kural gevşeterek "geçmiş" göstermek.

---

## 14. Mevcut Koda Geçiş (Migration) `[TÜM]`

Bu anayasa **bugünden sonraki tüm yeni kod için zorunludur.** Eski kod tek seferde düzeltilmez;
zamana yayılır.

- **Yeni kod istisnasız uyar.** Yeni dosya/özellik bu kurallarla yazılır.
- **Eski ihlali kopyalama.** Mevcut koddaki bir ihlali (UI'da `toLocale`, float para, ABACUS atlama vb.) "zaten böyle yapılmış" diye örnek alma; yeni kodda tekrarlama.
- **Toplu refactor yasak.** Dönüşüm parça parça, her biri kendi görevi olarak yapılır; onaysız geniş yeniden yazım yok.
- **Dokunduğun yeri temizle (fırsatçı geçiş).** Bir dosyada zaten çalışıyorsan, oradaki küçük ihlalleri o işin kapsamında standarda çek.
- **Zorlamayı kademeli sık.** Eski projede kural önce `warn` girip ihlaller azaldıkça `error`'a çekilebilir; ama **yeni projede baştan `error`.**
- Her projenin açık ihlal listesi ve geçiş durumu `PROJECT-NOTES.md`'de tutulur.

---

_Bu anayasa tüm projelerde birebir aynıdır. Projeye özgü tuzaklar, tablo/alan isimleri, port ve
stack ayrıntıları `PROJECT-NOTES.md`'de tutulur; oradaki hiçbir madde bu dosyayı gevşetemez._
