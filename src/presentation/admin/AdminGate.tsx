import { useCallback, useEffect, useRef, useState } from "react";
import { backupFileName, buildBackup, type BackupFile } from "../../application/admin/backup.ts";
import { ADMIN_IDLE_MS, type CostStore } from "../../application/admin/ports.ts";
import { rederiveSales, type PricingState } from "../../application/admin/pricing.ts";
import type { ImageResizer } from "../../application/ports/devices.ts";
import type { ImageMap, Meta } from "../../application/ports/stores.ts";
import type { Catalog } from "../../domain/catalog/catalog.ts";
import type { CostBook } from "../../domain/costs/costs.ts";
import type { Order } from "../../domain/order/order.ts";
import type { Settings } from "../../domain/settings/settings.ts";
import { AdminView, LockScreen } from "./AdminView.tsx";

/** Satış kabuğundan gelen ortak veri ve yazıcılar (maliyet içermez). */
export interface AdminBase {
  catalog: Catalog;
  settings: Settings;
  images: ImageMap;
  userImages: ImageMap;
  meta: Meta;
  usageBytes: number | null;
  resizer: ImageResizer;
  today: string;
  now: () => string;
  onCatalogChange: (catalog: Catalog) => void;
  onSettingsChange: (settings: Settings) => void;
  onImagesChange: (images: ImageMap) => Promise<string | null>;
  /** Yedeği ya hep ya hiç yazar; hata olursa mevcut veri korunur ve mesaj döner. */
  applyBackup: (backup: BackupFile) => string | null;
  onMetaChange: (meta: Meta) => void;
  onDownload: (blob: Blob, fileName: string) => void;
  resetSeed: () => void;
  onExit: () => void;
  /** Yedeğe eklenecek siparişler. */
  orders: readonly Order[];
}

export interface AdminGateProps {
  costStore: CostStore;
  base: AdminBase;
}

/**
 * Şifre perdesi + 5 dk işlemsizlik kilidi (PRD §5.2). Maliyetler yalnız kilit açıkken
 * belleğe alınır; satış ekranlarına hiçbir yoldan ulaşmaz (ADR-0002).
 */
export default function AdminGate({ costStore, base }: AdminGateProps) {
  const [unlocked, setUnlocked] = useState(false);
  const [costs, setCosts] = useState<CostBook>({});
  const [costError, setCostError] = useState<string | null>(null);
  const lastActivity = useRef(0);

  const lock = useCallback(() => {
    setUnlocked(false);
    setCosts({});
  }, []);

  useEffect(() => {
    if (!unlocked) return undefined;
    lastActivity.current = Date.now();
    const mark = () => {
      lastActivity.current = Date.now();
    };
    window.addEventListener("pointerdown", mark);
    window.addEventListener("keydown", mark);
    const timer = window.setInterval(() => {
      if (Date.now() - lastActivity.current > ADMIN_IDLE_MS) lock();
    }, 15_000);
    return () => {
      window.removeEventListener("pointerdown", mark);
      window.removeEventListener("keydown", mark);
      window.clearInterval(timer);
    };
  }, [unlocked, lock]);

  if (!unlocked) {
    return (
      <LockScreen
        onCancel={base.onExit}
        onUnlock={() => {
          const loaded = costStore.load();
          if (loaded.ok) {
            setCosts(loaded.value ?? {});
            setCostError(null);
          } else {
            setCosts({});
            setCostError(
              loaded.reason === "corrupt"
                ? "Alış fiyatları kaydı okunamadı; boş başlatıldı. Eski kayıt ayrı saklandı."
                : "Alış fiyatları bu tarayıcıda kaydedilemiyor.",
            );
          }
          setUnlocked(true);
        }}
      />
    );
  }

  const saveCosts = (next: CostBook) => {
    setCosts(next);
    const result = costStore.save(next);
    setCostError(result.ok ? null : "Alış fiyatları kaydedilemedi.");
  };

  const pricing: PricingState = { catalog: base.catalog, costs };
  const applyPricing = (next: PricingState) => {
    if (next.catalog !== base.catalog) base.onCatalogChange(next.catalog);
    if (next.costs !== costs) saveCosts(next.costs);
  };

  const lastBackup = base.meta.lastBackupAt;

  const onExport = (withCosts: boolean, withImages: boolean) => {
    const exportedAt = base.now();
    const meta: Meta = { ...base.meta, lastBackupAt: exportedAt };
    const backup = buildBackup({
      exportedAt,
      settings: base.settings,
      catalog: base.catalog,
      orders: base.orders,
      meta,
      costs: withCosts ? costs : null,
      images: withImages ? base.userImages : null,
    });
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    base.onDownload(blob, backupFileName(base.today, withCosts));
    base.onMetaChange(meta);
  };

  const onImport = (backup: BackupFile): string | null => {
    // Alışlar ayrı depoda: önce onlar yazılır, sonra diğerleri; biri başarısızsa hepsi geri döner.
    const previousCosts = costs;
    if (backup.costs !== null) {
      const saved = costStore.save(backup.costs);
      if (!saved.ok) {
        return saved.reason === "quota"
          ? "Cihazda yer kalmadı; yedek yüklenmedi. Mevcut veri olduğu gibi korundu."
          : "Yedek yüklenemedi. Mevcut veri olduğu gibi korundu.";
      }
    }
    const error = base.applyBackup(backup);
    if (error !== null) {
      if (backup.costs !== null) costStore.save(previousCosts);
      return error;
    }
    if (backup.costs !== null) setCosts(backup.costs);
    return null;
  };

  return (
    <>
      {costError !== null && (
        <p role="alert" style={{ padding: "8px 16px", color: "var(--bad)" }}>
          {costError}
        </p>
      )}
      <AdminView
        pricing={pricing}
        orders={base.orders}
        today={base.today}
        settings={base.settings}
        images={base.images}
        userImages={base.userImages}
        resizer={base.resizer}
        lastBackupAt={lastBackup}
        nowIso={base.now()}
        usageBytes={base.usageBytes}
        onPricingChange={applyPricing}
        onCatalogChange={base.onCatalogChange}
        onSettingsChange={(next) => {
          base.onSettingsChange(next);
          if (next.roundingStepMinor !== base.settings.roundingStepMinor) {
            applyPricing(rederiveSales(pricing, next.roundingStepMinor));
          }
        }}
        onImagesChange={base.onImagesChange}
        onExport={onExport}
        onImport={onImport}
        onResetSeed={() => {
          base.resetSeed();
          saveCosts({});
        }}
        onLock={() => {
          lock();
          base.onExit();
        }}
      />
    </>
  );
}
