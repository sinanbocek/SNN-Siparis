import { Search01Icon } from "@hugeicons/core-free-icons";
import { useMemo, useState } from "react";
import type { ImageMap } from "../../application/ports/stores.ts";
import { imageFor, matchesSearch } from "../../application/session.ts";
import { qtyOf, type Cart } from "../../domain/cart/cart.ts";
import {
  variantPsf,
  visibleFamilies,
  visibleVariants,
  type Catalog,
  type Variant,
} from "../../domain/catalog/catalog.ts";
import type { Settings } from "../../domain/settings/settings.ts";
import { fmtMoney } from "../parts/format.ts";
import { Icon, Lightbox, ProductImage, Stepper } from "../parts/parts.tsx";
import styles from "./sales.module.css";

interface Props {
  catalog: Catalog;
  settings: Settings;
  images: ImageMap;
  cart: Cart;
  onSetQty: (variant: Variant, qty: number) => void;
}

/** Katalog: yalnız liste (proje sahibi 25.09.2026). Adet doğrudan satırda girilir. */
export function CatalogView({ catalog, settings, images, cart, onSetQty }: Props) {
  const [query, setQuery] = useState("");
  const [zoom, setZoom] = useState<{ src: string; title: string; subtitle: string } | null>(null);
  const rows = useMemo(
    () =>
      visibleFamilies(catalog).flatMap((family) =>
        visibleVariants(catalog, family.id)
          .filter((v) => v.saleMinor !== null && matchesSearch(catalog, v, query))
          .map((variant) => ({ family, variant })),
      ),
    [catalog, query],
  );

  return (
    <section className={styles.page} aria-label="Katalog">
      <label className={styles.search}>
        <Icon icon={Search01Icon} size={16} />
        <input
          type="search"
          placeholder="Ürün ara"
          aria-label="Ürün ara"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      <div className={`card ${styles.list}`} role="table" aria-label="Ürün listesi">
        <div className={`${styles.catRow} ${styles.head}`} role="row">
          <span role="columnheader" className={styles.span2}>
            Ürün
          </span>
          <span role="columnheader" className={`num ${styles.colPrice}`}>
            Eczaneye
          </span>
          <span role="columnheader" className={`num ${styles.colPsf}`}>
            PSF
          </span>
          <span role="columnheader" className={styles.colQty}>
            Adet
          </span>
        </div>
        {rows.length === 0 && <p className={styles.empty}>Aramaya uyan ürün yok.</p>}
        {rows.map(({ family, variant }) => {
          const qty = qtyOf(cart, variant.id);
          const src = imageFor(images, family.id, variant.id);
          const psf = fmtMoney(variantPsf(variant, settings));
          return (
            <div
              key={variant.id}
              role="row"
              className={qty > 0 ? `${styles.catRow} ${styles.rowOn}` : styles.catRow}
            >
              <span role="cell">
                <ProductImage
                  src={src}
                  title={`${family.name} ${variant.name}`}
                  {...(src !== null && {
                    onOpen: () => setZoom({ src, title: family.name, subtitle: variant.name }),
                  })}
                />
              </span>
              <span role="cell" className={styles.name}>
                <b>{family.name}</b>
                <small>{variant.name}</small>
              </span>
              <span role="cell" className={styles.phonePrice}>
                <span>
                  Eczaneye <b className="num">{fmtMoney(variant.saleMinor)}</b>
                </span>
                <span>Perakende Satış Fiyatı {psf}</span>
              </span>
              <span role="cell" className={`num ${styles.colPrice} ${styles.price}`}>
                {fmtMoney(variant.saleMinor)}
              </span>
              <span role="cell" className={`num ${styles.colPsf} ${styles.muted}`}>
                {psf}
              </span>
              <span role="cell" className={styles.colQty}>
                <Stepper
                  value={qty}
                  label={`${family.name} ${variant.name}`}
                  onChange={(n) => onSetQty(variant, n)}
                />
              </span>
            </div>
          );
        })}
      </div>

      {zoom !== null && (
        <Lightbox
          src={zoom.src}
          title={zoom.title}
          subtitle={zoom.subtitle}
          onClose={() => setZoom(null)}
        />
      )}
    </section>
  );
}
