# Commit Düzeni

> SNN ailesiyle aynı biçim; kapsamlar bu projeye göre.

## Format

```
<tip>(<kapsam>): <türkçe açıklama>
```

Sürüm artışı varsa sona `(vX.Y.Z)` eklenir.

## Tipler (sabit, İngilizce)

`feat` · `fix` · `refactor` · `test` · `docs` · `chore` · `style` · `perf` · `ci` · `build`

## Kapsamlar

| Kapsam    | Alan                                              |
| --------- | ------------------------------------------------- |
| `domain`  | `src/domain/**` (fiyat, sepet, MF, sipariş)       |
| `costs`   | `src/domain/costs/**`, `src/application/admin/**` |
| `storage` | cihaz deposu, yedek                               |
| `sales`   | katalog, sepet, sipariş resmi, siparişler         |
| `admin`   | yönetim ekranı                                    |
| `pwa`     | çevrimdışı, güncelleme, simgeler                  |
| `prd`     | `PRD.md`                                          |
| `docs`    | diğer belgeler                                    |
| `ci`      | CI, hook, lint yapılandırması                     |

## Kurallar

- Açıklama Türkçe, küçük harfle başlar, nokta yok
- Tek commit tek iş
