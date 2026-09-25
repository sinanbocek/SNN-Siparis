import {
  Calculator01Icon,
  Logout01Icon,
  PackageIcon,
  Settings02Icon,
  Task01Icon,
} from "@hugeicons/core-free-icons";
import { useState } from "react";
import type { BackupFile } from "../../application/admin/backup.ts";
import { ADMIN_PASSWORD } from "../../application/admin/ports.ts";
import type { PricingState } from "../../application/admin/pricing.ts";
import type { ImageResizer } from "../../application/ports/devices.ts";
import type { ImageMap } from "../../application/ports/stores.ts";
import type { Catalog } from "../../domain/catalog/catalog.ts";
import type { Settings } from "../../domain/settings/settings.ts";
import { Icon } from "../parts/parts.tsx";
import { DataTab } from "./DataTab.tsx";
import { PricingTab } from "./PricingTab.tsx";
import { ProductsTab } from "./ProductsTab.tsx";
import { SettingsTab } from "./SettingsTab.tsx";
import styles from "./admin.module.css";

type Tab = "pricing" | "products" | "settings" | "data";

const TABS: readonly { id: Tab; label: string; icon: typeof PackageIcon }[] = [
  { id: "pricing", label: "Fiyatlama", icon: Calculator01Icon },
  { id: "products", label: "Ürünler", icon: PackageIcon },
  { id: "settings", label: "Ayarlar", icon: Settings02Icon },
  { id: "data", label: "Veri", icon: Task01Icon },
];

export interface AdminProps {
  pricing: PricingState;
  settings: Settings;
  images: ImageMap;
  userImages: ImageMap;
  resizer: ImageResizer;
  lastBackupAt: string | null;
  backupStale: boolean;
  usageBytes: number | null;
  onPricingChange: (state: PricingState) => void;
  onCatalogChange: (catalog: Catalog) => void;
  onSettingsChange: (settings: Settings) => void;
  onImagesChange: (images: ImageMap) => Promise<string | null>;
  onExport: (withCosts: boolean, withImages: boolean) => void;
  onImport: (backup: BackupFile) => string | null;
  onResetSeed: () => void;
  onLock: () => void;
}

/** Yönetim: ayrı dünya — turuncu bant, "Yönetim modu" etiketi (PRD §5.1). */
export function AdminView(props: AdminProps) {
  const [tab, setTab] = useState<Tab>("pricing");
  return (
    <section className={styles.admin} aria-label="Yönetim">
      <div className={styles.adminBar}>
        <span className={styles.adminTag}>Yönetim modu</span>
        <nav className={styles.tabs} aria-label="Yönetim sekmeleri">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              <Icon icon={t.icon} size={18} /> {t.label}
            </button>
          ))}
        </nav>
        <button type="button" className={styles.lockButton} onClick={props.onLock}>
          <Icon icon={Logout01Icon} size={18} /> Kilitle
        </button>
      </div>
      {props.backupStale && tab !== "data" && (
        <button type="button" className={styles.staleHint} onClick={() => setTab("data")}>
          Son yedek 7 günden eski. Veri sekmesinden yedek alın →
        </button>
      )}
      {tab === "pricing" && (
        <PricingTab
          state={props.pricing}
          settings={props.settings}
          onChange={props.onPricingChange}
        />
      )}
      {tab === "products" && (
        <ProductsTab
          catalog={props.pricing.catalog}
          images={props.images}
          userImages={props.userImages}
          resizer={props.resizer}
          onCatalogChange={props.onCatalogChange}
          onImagesChange={props.onImagesChange}
        />
      )}
      {tab === "settings" && (
        <SettingsTab settings={props.settings} onChange={props.onSettingsChange} />
      )}
      {tab === "data" && (
        <DataTab
          lastBackupAt={props.lastBackupAt}
          backupStale={props.backupStale}
          usageBytes={props.usageBytes}
          onExport={props.onExport}
          onImport={props.onImport}
          onResetSeed={props.onResetSeed}
        />
      )}
    </section>
  );
}

/** Şifre perdesi (G1: MVP'de kabul edilen risk). */
export function LockScreen({ onUnlock, onCancel }: { onUnlock: () => void; onCancel: () => void }) {
  const [value, setValue] = useState("");
  const [wrong, setWrong] = useState(false);
  return (
    <section className={styles.lock}>
      <form
        className={styles.lockCard}
        onSubmit={(e) => {
          e.preventDefault();
          if (value === ADMIN_PASSWORD) onUnlock();
          else {
            setWrong(true);
            setValue("");
          }
        }}
      >
        <h2>Yönetim</h2>
        <label>
          <span>Şifre</span>
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setWrong(false);
            }}
          />
        </label>
        {wrong && <p className={styles.errorText}>Şifre yanlış.</p>}
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onCancel}>
            Vazgeç
          </button>
          <button type="submit" className={styles.primary}>
            Aç
          </button>
        </div>
      </form>
    </section>
  );
}
