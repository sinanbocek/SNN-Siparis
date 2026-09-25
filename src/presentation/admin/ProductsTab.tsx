import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Delete02Icon,
  Image01Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import type { ImageResizer } from "../../application/ports/devices.ts";
import type { ImageMap } from "../../application/ports/stores.ts";
import { imageFor } from "../../application/session.ts";
import type { Catalog, Family, Variant } from "../../domain/catalog/catalog.ts";
import { useFeedback } from "../parts/feedback.tsx";
import { Icon, ProductImage } from "../parts/parts.tsx";
import styles from "./admin.module.css";

interface Props {
  catalog: Catalog;
  /** Başlangıç + kullanıcı görselleri (gösterim için). */
  images: ImageMap;
  /** Yalnız kullanıcının yüklediği görseller (yazma için). */
  userImages: ImageMap;
  resizer: ImageResizer;
  onCatalogChange: (catalog: Catalog) => void;
  onImagesChange: (images: ImageMap) => Promise<string | null>;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}`;
}

function swapOrder<T extends { id: string; order: number }>(
  items: readonly T[],
  id: string,
  dir: -1 | 1,
) {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  const i = sorted.findIndex((x) => x.id === id);
  const j = i + dir;
  const a = sorted[i];
  const b = sorted[j];
  if (a === undefined || b === undefined) return items;
  return items.map((x) =>
    x.id === a.id ? { ...x, order: b.order } : x.id === b.id ? { ...x, order: a.order } : x,
  );
}

/** Ürünler: ürün grubu ve çeşit ekle/düzenle/sil, sıralama, yayında/gizli, görsel. */
export function ProductsTab({
  catalog,
  images,
  userImages,
  resizer,
  onCatalogChange,
  onImagesChange,
}: Props) {
  const feedback = useFeedback();
  const families = [...catalog.families].sort((a, b) => a.order - b.order);

  const patchFamily = (id: string, patch: Partial<Family>) =>
    onCatalogChange({
      ...catalog,
      families: catalog.families.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    });
  const patchVariant = (id: string, patch: Partial<Variant>) =>
    onCatalogChange({
      ...catalog,
      variants: catalog.variants.map((v) => (v.id === id ? { ...v, ...patch } : v)),
    });

  const addFamily = () => {
    const order = families.reduce((m, f) => (f.order > m ? f.order : m), 0) + 1;
    onCatalogChange({
      ...catalog,
      families: [
        ...catalog.families,
        {
          id: newId("group"),
          name: "Yeni ürün",
          color: "#1F4E8C",
          accent: null,
          order,
          active: true,
        },
      ],
    });
  };

  const addVariant = (familyId: string) => {
    const order = catalog.variants.reduce((m, v) => (v.order > m ? v.order : m), 0) + 1;
    onCatalogChange({
      ...catalog,
      variants: [
        ...catalog.variants,
        {
          id: newId(familyId),
          familyId,
          name: "Yeni çeşit",
          unit: "kutu",
          saleMinor: null,
          psf: { mode: "computed" },
          pharmacistMarkup: null,
          vatRate: null,
          mfRule: null,
          order,
          active: true,
        },
      ],
    });
  };

  const removeFamily = async (family: Family) => {
    const ok = await feedback.confirm({
      title: "Ürün grubu silinsin mi?",
      message: `${family.name} ve tüm çeşitleri katalogdan silinecek. Geçmiş siparişler etkilenmez.`,
      confirmLabel: "Sil",
      danger: true,
    });
    if (!ok) return;
    onCatalogChange({
      families: catalog.families.filter((f) => f.id !== family.id),
      variants: catalog.variants.filter((v) => v.familyId !== family.id),
    });
  };

  const removeVariant = async (variant: Variant) => {
    const ok = await feedback.confirm({
      title: "Çeşit silinsin mi?",
      message: `${variant.name} katalogdan silinecek. Geçmiş siparişler etkilenmez.`,
      confirmLabel: "Sil",
      danger: true,
    });
    if (!ok) return;
    onCatalogChange({ ...catalog, variants: catalog.variants.filter((v) => v.id !== variant.id) });
  };

  const upload = async (key: string, file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await resizer.resize(file);
      const error = await onImagesChange({ ...userImages, [key]: dataUrl });
      feedback.toast(
        error === null
          ? { tone: "success", text: "Görsel kaydedildi." }
          : { tone: "error", text: error },
      );
    } catch {
      feedback.toast({ tone: "error", text: "Görsel okunamadı. JPG, PNG ya da WebP seçin." });
    }
  };

  const removeImage = async (key: string) => {
    const next = Object.fromEntries(Object.entries(userImages).filter(([k]) => k !== key));
    await onImagesChange(next);
  };

  return (
    <div className={styles.tab}>
      <div className={styles.familyList}>
        {families.map((f, fi) => {
          const variants = catalog.variants
            .filter((v) => v.familyId === f.id)
            .sort((a, b) => a.order - b.order);
          const famKey = `family:${f.id}`;
          return (
            <section
              key={f.id}
              className={f.active ? styles.family : `${styles.family} ${styles.inactive}`}
            >
              <div className={styles.familyHead}>
                <div className={styles.familyImage}>
                  <ProductImage src={imageFor(images, f.id, null)} title={f.name} />
                  <label className={styles.uploadButton}>
                    <Icon icon={Image01Icon} size={16} /> Görsel
                    <input
                      type="file"
                      accept="image/*"
                      className="srOnly"
                      onChange={(e) => void upload(famKey, e.target.files?.[0])}
                    />
                  </label>
                  {userImages[famKey] !== undefined && (
                    <button
                      type="button"
                      className={styles.link}
                      onClick={() => void removeImage(famKey)}
                    >
                      Görseli kaldır
                    </button>
                  )}
                </div>
                <div className={styles.familyFields}>
                  <label>
                    <span>Ürün grubu adı</span>
                    <input
                      value={f.name}
                      onChange={(e) => patchFamily(f.id, { name: e.target.value })}
                    />
                  </label>
                  <div className={styles.row}>
                    <label className={styles.check}>
                      <input
                        type="checkbox"
                        checked={f.active}
                        onChange={(e) => patchFamily(f.id, { active: e.target.checked })}
                      />
                      Yayında
                    </label>
                  </div>
                  <div className={styles.row}>
                    <button
                      type="button"
                      className={styles.iconButton}
                      aria-label="Yukarı taşı"
                      disabled={fi === 0}
                      onClick={() =>
                        onCatalogChange({
                          ...catalog,
                          families: swapOrder(catalog.families, f.id, -1),
                        })
                      }
                    >
                      <Icon icon={ArrowUp01Icon} size={18} />
                    </button>
                    <button
                      type="button"
                      className={styles.iconButton}
                      aria-label="Aşağı taşı"
                      disabled={fi === families.length - 1}
                      onClick={() =>
                        onCatalogChange({
                          ...catalog,
                          families: swapOrder(catalog.families, f.id, 1),
                        })
                      }
                    >
                      <Icon icon={ArrowDown01Icon} size={18} />
                    </button>
                    <button type="button" className="btnDanger" onClick={() => removeFamily(f)}>
                      <Icon icon={Delete02Icon} size={18} /> Grubu sil
                    </button>
                  </div>
                </div>
              </div>

              <table className={`${styles.table} ${styles.stack}`}>
                <thead>
                  <tr>
                    <th>Çeşit</th>
                    <th>Birim</th>
                    <th>Yayında</th>
                    <th>Görsel</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v, vi) => {
                    const key = `variant:${v.id}`;
                    return (
                      <tr key={v.id} className={v.active ? undefined : styles.inactive}>
                        <td data-label="Çeşit">
                          <input
                            aria-label="Çeşit adı"
                            value={v.name}
                            onChange={(e) => patchVariant(v.id, { name: e.target.value })}
                          />
                        </td>
                        <td data-label="Birim">
                          <input
                            aria-label="Birim"
                            className={styles.short}
                            value={v.unit}
                            onChange={(e) => patchVariant(v.id, { unit: e.target.value })}
                          />
                        </td>
                        <td data-label="Yayında">
                          <input
                            type="checkbox"
                            aria-label="Yayında"
                            checked={v.active}
                            onChange={(e) => patchVariant(v.id, { active: e.target.checked })}
                          />
                        </td>
                        <td data-label="Görsel">
                          <label className={styles.uploadButton}>
                            <Icon icon={Image01Icon} size={16} />
                            {userImages[key] !== undefined || images[key] !== undefined
                              ? "Değiştir"
                              : "Ekle"}
                            <input
                              type="file"
                              accept="image/*"
                              className="srOnly"
                              onChange={(e) => void upload(key, e.target.files?.[0])}
                            />
                          </label>
                          {userImages[key] !== undefined && (
                            <button
                              type="button"
                              className={styles.link}
                              onClick={() => void removeImage(key)}
                            >
                              Kaldır
                            </button>
                          )}
                        </td>
                        <td className={styles.rowActions} data-label="">
                          <button
                            type="button"
                            className={styles.iconButton}
                            aria-label="Yukarı"
                            disabled={vi === 0}
                            onClick={() =>
                              onCatalogChange({
                                ...catalog,
                                variants: swapOrder(catalog.variants, v.id, -1),
                              })
                            }
                          >
                            <Icon icon={ArrowUp01Icon} size={16} />
                          </button>
                          <button
                            type="button"
                            className={styles.iconButton}
                            aria-label="Aşağı"
                            disabled={vi === variants.length - 1}
                            onClick={() =>
                              onCatalogChange({
                                ...catalog,
                                variants: swapOrder(catalog.variants, v.id, 1),
                              })
                            }
                          >
                            <Icon icon={ArrowDown01Icon} size={16} />
                          </button>
                          <button
                            type="button"
                            className={styles.iconButton}
                            aria-label="Sil"
                            onClick={() => removeVariant(v)}
                          >
                            <Icon icon={Delete02Icon} size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <button type="button" className="btn" onClick={() => addVariant(f.id)}>
                <Icon icon={PlusSignIcon} size={16} /> Çeşit ekle
              </button>
              {variants.some((v) => v.saleMinor === null) && (
                <p className={styles.warnText}>
                  Fiyatı girilmemiş çeşit katalogda görünmez. Fiyatlama sekmesinden fiyat verin.
                </p>
              )}
            </section>
          );
        })}
      </div>
      <button type="button" className="btnPrimary" onClick={addFamily}>
        <Icon icon={PlusSignIcon} size={18} /> Ürün grubu ekle
      </button>
    </div>
  );
}
