# SNN Sipariş

Eczane ziyaretinde tabletten sipariş almak için web uygulaması. Pazarlamacı kataloğu gösterir,
adetleri girer, eczacıya ödeyeceği ve rafta satınca kazanacağı tutarı anında gösterir. Anlaşma
olunca sipariş formu resim (PNG) olarak üretilir ve WhatsApp ile depoya gönderilir.

- Canlı: https://snn-siparis.web.app
- Gereksinimler: [PRD.md](PRD.md) · Mimari: [ARCHITECTURE.md](ARCHITECTURE.md)

## Kurulum

```bash
npm install
```

```bash
npm run dev
```

## Kontroller ve yayın

```bash
npm run build
```

```bash
npm test
```

```bash
npm run deploy
```

Yayın elle yapılır (ADR-0004). Firebase komut satırı aracı kurulu ve girişli olmalıdır.

## Veri nerede?

Veritabanı yoktur. Tüm veri kullanılan cihazın tarayıcısında durur. Cihaz değiştirmek için
Yönetim → Veri → **Yedek al**, diğer cihazda **Yedek yükle**. Maliyetler yalnız yönetim ekranında
görünür ve yalnız cihazda saklanır.
