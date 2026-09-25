import { GridViewIcon, ListViewIcon, Search01Icon } from "@hugeicons/core-free-icons";
import { useMemo, useState } from "react";
import { imageFor, matchesSearch } from "../../application/session.ts";
import type { ImageMap } from "../../application/ports/stores.ts";
import { qtyOf, type Cart } from "../../domain/cart/cart.ts";
import {
  variantPsf,
  visibleFamilies,
  visibleVariants,
  type Catalog,
  type Family,
  type Variant,
} from "../../domain/catalog/catalog.ts";
import type { Settings } from "../../domain/settings/settings.ts";
import { fmtAmount } from "../parts/format.ts";
import { Icon, ProductImage, Stepper } from "../parts/parts.tsx";
import styles from "./sales.module.css";

export type CatalogMode = "cards" | "list";

interface Props {
  catalog: Catalog;
  settings: Settings;
  images: ImageMap;
  cart: Cart;
  mode: CatalogMode;
  onModeChange: (mode: CatalogMode) => void;
  onSetQty: (variant: Variant, qty: number) => void;
}

/** Katalog (karar E1: kart ↔ liste geçişi). Adet doğrudan kartta girilir; ayrı "sepete ekle" yok. */
export function CatalogView({
  catalog,
  settings,
  images,
  cart,
  mode,
  onModeChange,
  onSetQty,
}: Props) {
  const [query, setQuery] = useState("");
  const groups = useMemo(
    () =>
      visibleFamilies(catalog)
        .map((family) => ({
          family,
          variants: visibleVariants(catalog, family.id).filter(
            (v) => v.saleMinor !== null && matchesSearch(catalog, v, query),
          ),
        }))
        .filter((g) => g.variants.length > 0),
    [catalog, query],
  );

  return (
    <section className={styles.page} aria-label="Katalog">
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Icon icon={Search01Icon} size={18} />
          <input
            type="search"
            placeholder="Ürün ara"
            aria-label="Ürün ara"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className={styles.segment} role="group" aria-label="Görünüm">
          <button
            type="button"
            aria-pressed={mode === "cards"}
            onClick={() => onModeChange("cards")}
          >
            <Icon icon={GridViewIcon} size={18} /> Kart
          </button>
          <button type="button" aria-pressed={mode === "list"} onClick={() => onModeChange("list")}>
            <Icon icon={ListViewIcon} size={18} /> Liste
          </button>
        </div>
      </div>

      {groups.length === 0 && <p className={styles.empty}>Aramaya uyan ürün yok.</p>}

      {mode === "cards" ? (
        <div className={styles.cardGrid}>
          {groups.map(({ family, variants }) => (
            <FamilyCard
              key={family.id}
              family={family}
              variants={variants}
              settings={settings}
              images={images}
              cart={cart}
              onSetQty={onSetQty}
            />
          ))}
        </div>
      ) : (
        <div className={styles.listTable} role="table" aria-label="Ürün listesi">
          <div className={`${styles.listRow} ${styles.listHead}`} role="row">
            <span role="columnheader" />
            <span role="columnheader">Ürün</span>
            <span role="columnheader" className="num">
              Eczaneye
            </span>
            <span role="columnheader" className={`num ${styles.hidePhone}`}>
              PSF
            </span>
            <span role="columnheader" className={styles.center}>
              Adet
            </span>
          </div>
          {groups.flatMap(({ family, variants }) =>
            variants.map((v) => {
              const qty = qtyOf(cart, v.id);
              return (
                <div
                  key={v.id}
                  role="row"
                  className={qty > 0 ? `${styles.listRow} ${styles.listRowOn}` : styles.listRow}
                  style={{ borderLeftColor: qty > 0 ? family.color : "transparent" }}
                >
                  <span role="cell">
                    <ProductImage
                      size="sm"
                      src={imageFor(images, family.id, v.id)}
                      color={family.color}
                      accent={family.accent}
                      title={family.name}
                    />
                  </span>
                  <span role="cell" className={styles.listName}>
                    <b>{family.name}</b> {v.name}
                  </span>
                  <span role="cell" className="num">
                    {fmtAmount(v.saleMinor)}
                  </span>
                  <span role="cell" className={`num ${styles.hidePhone} ${styles.muted}`}>
                    {fmtAmount(variantPsf(v, settings))}
                  </span>
                  <span role="cell" className={styles.center}>
                    <Stepper
                      compact
                      value={qty}
                      label={`${family.name} ${v.name}`}
                      onChange={(n) => onSetQty(v, n)}
                    />
                  </span>
                </div>
              );
            }),
          )}
        </div>
      )}
    </section>
  );
}

function FamilyCard({
  family,
  variants,
  settings,
  images,
  cart,
  onSetQty,
}: {
  family: Family;
  variants: Variant[];
  settings: Settings;
  images: ImageMap;
  cart: Cart;
  onSetQty: (variant: Variant, qty: number) => void;
}) {
  const active = variants.some((v) => qtyOf(cart, v.id) > 0);
  const first = variants[0];
  return (
    <article
      className={active ? `${styles.card} ${styles.cardOn}` : styles.card}
      style={{ borderColor: active ? family.color : undefined }}
    >
      <ProductImage
        src={imageFor(images, family.id, first ? first.id : null)}
        color={family.color}
        accent={family.accent}
        title={family.name}
        subtitle={variants.length === 1 && first ? first.name : `${variants.length} çeşit`}
      />
      <h3 className={styles.cardTitle}>
        <span className={styles.dot} style={{ background: family.color }} />
        {family.name}
      </h3>
      <ul className={styles.variantList}>
        {variants.map((v) => (
          <li key={v.id}>
            <div>
              <span className={styles.variantName}>{v.name}</span>
              <span className={styles.variantPrice}>
                <b className="num">{fmtAmount(v.saleMinor)}</b>
                <span className={styles.muted}> · PSF {fmtAmount(variantPsf(v, settings))}</span>
              </span>
            </div>
            <Stepper
              value={qtyOf(cart, v.id)}
              label={`${family.name} ${v.name}`}
              onChange={(n) => onSetQty(v, n)}
            />
          </li>
        ))}
      </ul>
    </article>
  );
}
