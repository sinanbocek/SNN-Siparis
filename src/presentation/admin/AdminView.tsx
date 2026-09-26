import {
  Calculator01Icon,
  ChartHistogramIcon,
  LockIcon,
  PackageIcon,
  Settings02Icon,
  Task01Icon,
} from "@hugeicons/core-free-icons";
import { text } from "@snn/abacus-core";
import { useState } from "react";
import type { BackupFile } from "../../application/admin/backup.ts";
import { ADMIN_PASSWORD } from "../../application/admin/ports.ts";
import type { PricingState } from "../../application/admin/pricing.ts";
import type { ImageResizer } from "../../application/ports/devices.ts";
import type { ImageMap } from "../../application/ports/stores.ts";
import type { Catalog } from "../../domain/catalog/catalog.ts";
import type { Settings } from "../../domain/settings/settings.ts";
import { Icon } from "../parts/parts.tsx";
import type { AppInfo } from "./AdminGate.tsx";
import { DataTab } from "./DataTab.tsx";
import { PricingTab } from "./PricingTab.tsx";
import { ReportsTab } from "./ReportsTab.tsx";
import type { Order } from "../../domain/order/order.ts";
import { ProductsTab } from "./ProductsTab.tsx";
import { SettingsTab } from "./SettingsTab.tsx";
import styles from "./admin.module.css";

type Tab = "reports" | "pricing" | "products" | "settings" | "data";

const TABS: readonly { id: Tab; label: string; icon: typeof PackageIcon }[] = [
  { id: "reports", label: "Raporlar", icon: ChartHistogramIcon },
  { id: "pricing", label: "Fiyatlama", icon: Calculator01Icon },
  { id: "products", label: "Ürünler", icon: PackageIcon },
  { id: "settings", label: "Ayarlar", icon: Settings02Icon },
  { id: "data", label: "Veri", icon: Task01Icon },
];

export interface AdminProps {
  pricing: PricingState;
  orders: readonly Order[];
  today: string;
  settings: Settings;
  images: ImageMap;
  userImages: ImageMap;
  resizer: ImageResizer;
  lastBackupAt: string | null;
  nowIso: string;
  usageBytes: number | null;
  onPricingChange: (state: PricingState) => void;
  onCatalogChange: (catalog: Catalog) => void;
  onSettingsChange: (settings: Settings) => string | null;
  onPriceSettingsSave: (settings: Settings, catalog: Catalog) => string | null;
  app: AppInfo;
  onImagesChange: (images: ImageMap) => Promise<string | null>;
  onExport: (withCosts: boolean, withImages: boolean) => void;
  onImport: (backup: BackupFile) => string | null;
  onResetSeed: () => void;
  onLock: () => void;
}

/** Yönetim: ayrı dünya — turuncu bant, "Yönetim modu" etiketi (PRD §5.1). */
export function AdminView(props: AdminProps) {
  const [tab, setTab] = useState<Tab>("reports");
  return (
    <section className={styles.admin} aria-label="Yönetim">
      <div className={styles.adminBar}>
        <span className={styles.adminTag}>Yönetim</span>
        <nav className="tabs" aria-label="Yönetim sekmeleri">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              <Icon icon={t.icon} size={16} />
              <span className={styles.tabLabel}>{t.label}</span>
            </button>
          ))}
        </nav>
      </div>
      {tab === "reports" && (
        <ReportsTab
          orders={props.orders}
          catalog={props.pricing.catalog}
          costs={props.pricing.costs}
          today={props.today}
          onGoPricing={() => setTab("pricing")}
        />
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
        <SettingsTab
          settings={props.settings}
          pricing={props.pricing}
          app={props.app}
          today={props.today}
          onChange={props.onSettingsChange}
          onPriceSave={props.onPriceSettingsSave}
          onLock={props.onLock}
        />
      )}
      {tab === "data" && (
        <DataTab
          lastBackupAt={props.lastBackupAt}
          nowIso={props.nowIso}
          usageBytes={props.usageBytes}
          onExport={props.onExport}
          onImport={props.onImport}
          onResetSeed={props.onResetSeed}
        />
      )}
    </section>
  );
}

/**
 * Şifre perdesi (G1: MVP'de kabul edilen risk). Şifre uzunluğuna ulaşınca kendiliğinden
 * denenir. Kutu metin tipinde ama noktalı gösterilir: telefonda yalnız rakam klavyesi açılır.
 */
export function LockScreen({ onUnlock, onCancel }: { onUnlock: () => void; onCancel: () => void }) {
  const [value, setValue] = useState("");
  const [wrong, setWrong] = useState(false);
  return (
    <section className={styles.lock}>
      <div className={`card ${styles.lockCard}`}>
        <span className={styles.lockIcon} aria-hidden="true">
          <Icon icon={LockIcon} size={18} />
        </span>
        <h2>Yönetim</h2>
        <p className="hint">Şifreyi girin; doğruysa kendiliğinden açılır.</p>
        <input
          aria-label="Şifre"
          className={styles.pin}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          value={value}
          onChange={(e) => {
            const next = text.digits(e.target.value);
            setWrong(false);
            if (next.length >= ADMIN_PASSWORD.length) {
              if (next === ADMIN_PASSWORD) {
                onUnlock();
                return;
              }
              setWrong(true);
              setValue("");
              return;
            }
            setValue(next);
          }}
        />
        {wrong && <p className={styles.errorText}>Şifre yanlış.</p>}
        <button type="button" className="btn" onClick={onCancel}>
          Vazgeç
        </button>
      </div>
    </section>
  );
}
