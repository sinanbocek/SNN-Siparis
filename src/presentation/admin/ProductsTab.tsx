import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  Delete02Icon,
  Image01Icon,
  MoreVerticalIcon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { useRef, useState } from "react";
import type { ImageResizer } from "../../application/ports/devices.ts";
import type { ImageMap } from "../../application/ports/stores.ts";
import { imageFor } from "../../application/session.ts";
import type { Catalog, Family, Variant } from "../../domain/catalog/catalog.ts";
import { useFeedback } from "../parts/feedback.tsx";
import { Icon, Modal, ProductImage } from "../parts/parts.tsx";
import ed from "./priceEditor.module.css";
import styles from "./products.module.css";

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

function nextOrder(items: readonly { order: number }[]): number {
  return items.reduce((m, x) => (x.order > m ? x.order : m), 0) + 1;
}

/** Yayında / gizli aç-kapa; satırın tıklamasını tetiklemez. */
function Switch({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={styles.switch}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
    >
      <span aria-hidden="true" />
    </button>
  );
}

type Editing =
  | { readonly kind: "family"; readonly id: string | null }
  | { readonly kind: "variant"; readonly id: string | null; readonly familyId: string };

/**
 * Ürünler (taslak A, 26.09.2026): liste yalnız okunur ve kompakt; satıra dokununca düzenleme
 * penceresi. Yayında aç-kapa satırda; görsel, sıra ve silme pencerede.
 */
export function ProductsTab({
  catalog,
  images,
  userImages,
  resizer,
  onCatalogChange,
  onImagesChange,
}: Props) {
  const feedback = useFeedback();
  const [editing, setEditing] = useState<Editing | null>(null);
  const families = [...catalog.families].sort((a, b) => a.order - b.order);
  const variantsOf = (familyId: string) =>
    catalog.variants.filter((v) => v.familyId === familyId).sort((a, b) => a.order - b.order);

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

  const editingFamily =
    editing?.kind === "family" && editing.id !== null
      ? catalog.families.find((f) => f.id === editing.id)
      : undefined;
  const editingVariant =
    editing?.kind === "variant" && editing.id !== null
      ? catalog.variants.find((v) => v.id === editing.id)
      : undefined;

  return (
    <div className={styles.page}>
      {families.map((f) => {
        const variants = variantsOf(f.id);
        return (
          <section
            key={f.id}
            className={f.active ? styles.group : `${styles.group} ${styles.off}`}
            aria-label={f.name}
          >
            <div className={styles.groupHead}>
              <span className={styles.thumb}>
                <ProductImage src={imageFor(images, f.id, null)} title={f.name} />
              </span>
              <span className={styles.name}>
                <b>{f.name}</b>
                <small>{variants.length} çeşit</small>
              </span>
              <Switch
                checked={f.active}
                label={`${f.name} yayında`}
                onChange={(active) => patchFamily(f.id, { active })}
              />
              <button
                type="button"
                className={styles.more}
                aria-label={`${f.name} grubunu düzenle`}
                onClick={() => setEditing({ kind: "family", id: f.id })}
              >
                <Icon icon={MoreVerticalIcon} size={18} />
              </button>
            </div>
            <ul className={styles.rows}>
              {variants.map((v) => (
                <li key={v.id} className={v.active ? undefined : styles.off}>
                  <div
                    role="button"
                    tabIndex={0}
                    className={styles.row}
                    aria-label={`${f.name} ${v.name} düzenle`}
                    onClick={() => setEditing({ kind: "variant", id: v.id, familyId: f.id })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setEditing({ kind: "variant", id: v.id, familyId: f.id });
                      }
                    }}
                  >
                    <span className={styles.thumb}>
                      <ProductImage src={imageFor(images, f.id, v.id)} title={v.name} />
                    </span>
                    <span className={styles.name}>
                      <span>
                        {v.name} <small>· {v.unit}</small>
                      </span>
                      {v.saleMinor === null && (
                        <small className={styles.noPrice}>Fiyat yok · katalogda görünmez</small>
                      )}
                    </span>
                    <Switch
                      checked={v.active}
                      label={`${f.name} ${v.name} yayında`}
                      onChange={(active) => patchVariant(v.id, { active })}
                    />
                    <span className={styles.chevron} aria-hidden="true">
                      <Icon icon={ArrowRight01Icon} size={16} />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className={styles.add}
              onClick={() => setEditing({ kind: "variant", id: null, familyId: f.id })}
            >
              <Icon icon={PlusSignIcon} size={16} /> Çeşit ekle
            </button>
          </section>
        );
      })}
      <button
        type="button"
        className="btnPrimary"
        onClick={() => setEditing({ kind: "family", id: null })}
      >
        <Icon icon={PlusSignIcon} size={18} /> Ürün grubu ekle
      </button>

      {editing?.kind === "variant" && (editing.id === null || editingVariant !== undefined) && (
        <VariantEditor
          variant={editingVariant ?? null}
          familyName={catalog.families.find((f) => f.id === editing.familyId)?.name ?? ""}
          siblings={variantsOf(editing.familyId)}
          image={
            editingVariant === undefined
              ? null
              : imageFor(images, editing.familyId, editingVariant.id)
          }
          hasOwnImage={
            editingVariant !== undefined && userImages[`variant:${editingVariant.id}`] !== undefined
          }
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            if (editingVariant === undefined) {
              onCatalogChange({
                ...catalog,
                variants: [
                  ...catalog.variants,
                  {
                    id: newId(editing.familyId),
                    familyId: editing.familyId,
                    name: patch.name,
                    unit: patch.unit,
                    saleMinor: null,
                    psf: { mode: "computed" },
                    pharmacistMarkup: null,
                    vatRate: null,
                    mfRule: null,
                    order: nextOrder(catalog.variants),
                    active: true,
                  },
                ],
              });
              feedback.toast({
                text: "Çeşit eklendi. Katalogda görünmesi için Fiyatlama'dan fiyat verin.",
                tone: "success",
              });
            } else {
              patchVariant(editingVariant.id, patch);
              feedback.toast({ text: "Kayıt güncellendi.", tone: "success" });
            }
            setEditing(null);
          }}
          onMove={(dir) =>
            editingVariant !== undefined &&
            onCatalogChange({
              ...catalog,
              variants: swapOrder(catalog.variants, editingVariant.id, dir),
            })
          }
          onUpload={(file) =>
            editingVariant !== undefined && void upload(`variant:${editingVariant.id}`, file)
          }
          onRemoveImage={() =>
            editingVariant !== undefined && void removeImage(`variant:${editingVariant.id}`)
          }
          onDelete={async () => {
            if (editingVariant === undefined) return;
            const ok = await feedback.confirm({
              title: "Çeşit silinsin mi?",
              message: `${editingVariant.name} katalogdan silinecek. Geçmiş siparişler etkilenmez.`,
              confirmLabel: "Sil",
              danger: true,
            });
            if (!ok) return;
            onCatalogChange({
              ...catalog,
              variants: catalog.variants.filter((v) => v.id !== editingVariant.id),
            });
            setEditing(null);
            feedback.toast({ text: "Çeşit silindi.", tone: "info" });
          }}
        />
      )}

      {editing?.kind === "family" && (editing.id === null || editingFamily !== undefined) && (
        <FamilyEditor
          family={editingFamily ?? null}
          index={editingFamily === undefined ? -1 : families.indexOf(editingFamily)}
          count={families.length}
          variantCount={editingFamily === undefined ? 0 : variantsOf(editingFamily.id).length}
          image={editingFamily === undefined ? null : imageFor(images, editingFamily.id, null)}
          hasOwnImage={
            editingFamily !== undefined && userImages[`family:${editingFamily.id}`] !== undefined
          }
          onClose={() => setEditing(null)}
          onSave={(name) => {
            if (editingFamily === undefined) {
              onCatalogChange({
                ...catalog,
                families: [
                  ...catalog.families,
                  {
                    id: newId("group"),
                    name,
                    color: "#1F4E8C",
                    accent: null,
                    order: nextOrder(catalog.families),
                    active: true,
                  },
                ],
              });
              feedback.toast({ text: "Ürün grubu eklendi.", tone: "success" });
            } else {
              patchFamily(editingFamily.id, { name });
              feedback.toast({ text: "Kayıt güncellendi.", tone: "success" });
            }
            setEditing(null);
          }}
          onMove={(dir) =>
            editingFamily !== undefined &&
            onCatalogChange({
              ...catalog,
              families: swapOrder(catalog.families, editingFamily.id, dir),
            })
          }
          onUpload={(file) =>
            editingFamily !== undefined && void upload(`family:${editingFamily.id}`, file)
          }
          onRemoveImage={() =>
            editingFamily !== undefined && void removeImage(`family:${editingFamily.id}`)
          }
          onDelete={async () => {
            if (editingFamily === undefined) return;
            const ok = await feedback.confirm({
              title: "Ürün grubu silinsin mi?",
              message: `${editingFamily.name} ve tüm çeşitleri katalogdan silinecek. Geçmiş siparişler etkilenmez.`,
              confirmLabel: "Sil",
              danger: true,
            });
            if (!ok) return;
            onCatalogChange({
              families: catalog.families.filter((f) => f.id !== editingFamily.id),
              variants: catalog.variants.filter((v) => v.familyId !== editingFamily.id),
            });
            setEditing(null);
            feedback.toast({ text: "Ürün grubu silindi.", tone: "info" });
          }}
        />
      )}
    </div>
  );
}

/** Kaydet kilidi: basılınca kilitlenir, hata olursa açılır (fiyat penceresiyle aynı). */
function useSaveLock() {
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const run = (save: () => boolean) => {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    if (!save()) {
      busy.current = false;
      setSaving(false);
    }
  };
  return { saving, run };
}

interface ItemActions {
  image: string | null;
  hasOwnImage: boolean;
  onClose: () => void;
  onMove: (dir: -1 | 1) => void;
  onUpload: (file: File | undefined) => void;
  onRemoveImage: () => void;
  onDelete: () => void;
}

/** Görsel, sıra ve sil: anında uygulanır (Kaydet beklemez). Yeni kayıtta gösterilmez. */
function ItemTools({
  title,
  canUp,
  canDown,
  deleteLabel,
  actions,
}: {
  title: string;
  canUp: boolean;
  canDown: boolean;
  deleteLabel: string;
  actions: ItemActions;
}) {
  return (
    <section className={ed.section} aria-label="Görsel, sıra ve silme">
      <h3>Görsel ve sıra</h3>
      <p className={styles.hint}>Bu işlemler hemen uygulanır.</p>
      <div className={styles.imageLine}>
        <span className={styles.bigThumb}>
          <ProductImage src={actions.image} title={title} />
        </span>
        <div className={styles.imageButtons}>
          <label className="btn">
            <Icon icon={Image01Icon} size={16} />{" "}
            {actions.image === null ? "Görsel ekle" : "Değiştir"}
            <input
              type="file"
              accept="image/*"
              className="srOnly"
              onChange={(e) => actions.onUpload(e.target.files?.[0])}
            />
          </label>
          {actions.hasOwnImage && (
            <button type="button" className="btn" onClick={actions.onRemoveImage}>
              Görseli kaldır
            </button>
          )}
        </div>
      </div>
      <div className={styles.toolRow}>
        <button type="button" className="btn" disabled={!canUp} onClick={() => actions.onMove(-1)}>
          <Icon icon={ArrowUp01Icon} size={16} /> Yukarı taşı
        </button>
        <button type="button" className="btn" disabled={!canDown} onClick={() => actions.onMove(1)}>
          <Icon icon={ArrowDown01Icon} size={16} /> Aşağı taşı
        </button>
      </div>
      <button type="button" className={`btnDanger ${styles.delete}`} onClick={actions.onDelete}>
        <Icon icon={Delete02Icon} size={16} /> {deleteLabel}
      </button>
    </section>
  );
}

function EditorFooter({
  error,
  saving,
  onClose,
  onSave,
}: {
  error: string | null;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <>
      {error !== null && (
        <p className={ed.error} role="alert">
          {error}
        </p>
      )}
      <div className={ed.footButtons}>
        <button type="button" className="btn" onClick={onClose}>
          Vazgeç
        </button>
        <button
          type="button"
          className="btnPrimary"
          disabled={saving}
          aria-busy={saving}
          onClick={onSave}
        >
          {saving ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </div>
    </>
  );
}

function VariantEditor({
  variant,
  familyName,
  siblings,
  onSave,
  ...actions
}: ItemActions & {
  variant: Variant | null;
  familyName: string;
  siblings: readonly Variant[];
  onSave: (patch: { name: string; unit: string }) => void;
}) {
  const [name, setName] = useState(variant?.name ?? "");
  const [unit, setUnit] = useState(variant?.unit ?? "kutu");
  const [error, setError] = useState<string | null>(null);
  const lock = useSaveLock();
  const index = variant === null ? -1 : siblings.findIndex((v) => v.id === variant.id);

  const save = () =>
    lock.run(() => {
      if (name.trim() === "") {
        setError("Çeşit adını yazın.");
        return false;
      }
      if (unit.trim() === "") {
        setError("Birimi yazın (ör. kutu).");
        return false;
      }
      onSave({ name: name.trim(), unit: unit.trim() });
      return true;
    });

  return (
    <Modal
      title={variant === null ? `${familyName} · yeni çeşit` : `${familyName} ${variant.name}`}
      onClose={actions.onClose}
      footer={
        <EditorFooter error={error} saving={lock.saving} onClose={actions.onClose} onSave={save} />
      }
    >
      <section className={ed.section}>
        <label className={ed.field}>
          <span>Çeşit adı</span>
          <input
            value={name}
            placeholder="60 Kapsül"
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
          />
        </label>
        <label className={ed.field}>
          <span>Birim</span>
          <input
            className={styles.unit}
            value={unit}
            onChange={(e) => {
              setUnit(e.target.value);
              setError(null);
            }}
          />
        </label>
        {variant === null && (
          <p className={styles.hint}>
            Fiyatı Fiyatlama sekmesinden verin; fiyatsız çeşit katalogda görünmez.
          </p>
        )}
      </section>
      {variant !== null && (
        <ItemTools
          title={variant.name}
          canUp={index > 0}
          canDown={index >= 0 && index < siblings.length - 1}
          deleteLabel="Çeşidi sil"
          actions={actions}
        />
      )}
    </Modal>
  );
}

function FamilyEditor({
  family,
  index,
  count,
  variantCount,
  onSave,
  ...actions
}: ItemActions & {
  family: Family | null;
  index: number;
  count: number;
  variantCount: number;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(family?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const lock = useSaveLock();

  const save = () =>
    lock.run(() => {
      if (name.trim() === "") {
        setError("Ürün grubu adını yazın.");
        return false;
      }
      onSave(name.trim());
      return true;
    });

  return (
    <Modal
      title={family === null ? "Yeni ürün grubu" : family.name}
      onClose={actions.onClose}
      footer={
        <EditorFooter error={error} saving={lock.saving} onClose={actions.onClose} onSave={save} />
      }
    >
      <section className={ed.section}>
        <label className={ed.field}>
          <span>Ürün grubu adı</span>
          <input
            value={name}
            placeholder="Gardegen"
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
          />
        </label>
        {family !== null && <p className={styles.hint}>{variantCount} çeşit bu grupta.</p>}
      </section>
      {family !== null && (
        <ItemTools
          title={family.name}
          canUp={index > 0}
          canDown={index >= 0 && index < count - 1}
          deleteLabel="Grubu sil"
          actions={actions}
        />
      )}
    </Modal>
  );
}
