import { FileExportIcon, FileImportIcon, RefreshIcon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { parseBackup, type BackupFile } from "../../application/admin/backup.ts";
import { fmtBytes, fmtStamp } from "../parts/format.ts";
import { useFeedback } from "../parts/feedback.tsx";
import { Banner, Icon } from "../parts/parts.tsx";
import styles from "./admin.module.css";

interface Props {
  lastBackupAt: string | null;
  nowIso: string;
  backupStale: boolean;
  usageBytes: number | null;
  onExport: (withCosts: boolean, withImages: boolean) => void;
  onImport: (backup: BackupFile) => string | null;
  onResetSeed: () => void;
}

/** Veri: yedek al / yükle (F, D6, G5), depo kullanımı, başlangıca sıfırla. */
export function DataTab({
  lastBackupAt,
  nowIso,
  backupStale,
  usageBytes,
  onExport,
  onImport,
  onResetSeed,
}: Props) {
  const [withCosts, setWithCosts] = useState(true);
  const [withImages, setWithImages] = useState(true);
  const feedback = useFeedback();

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    const parsed = parseBackup(await file.text());
    if (!parsed.ok) {
      feedback.toast({ tone: "error", text: `${parsed.message} Mevcut veri değişmedi.` });
      return;
    }
    const sum = parsed.summary;
    const ok = await feedback.confirm({
      title: "Yedek yüklensin mi?",
      message: [
        `${fmtStamp(sum.exportedAt, nowIso)} tarihli yedek:`,
        `${sum.families} ürün grubu, ${sum.variants} ürün,`,
        sum.costs > 0 ? `${sum.costs} maliyet,` : "maliyet yok,",
        `${sum.orders} sipariş, ${sum.images} görsel.`,
        "Bu cihazdaki ürünler, fiyatlar, ayarlar ve siparişler yedektekiyle değiştirilecek.",
        parsed.backup.costs === null ? "Yedekte maliyet yok; bu cihazdaki maliyetler korunur." : "",
      ].join(" "),
      confirmLabel: "Yükle",
      danger: true,
    });
    if (!ok) return;
    const error = onImport(parsed.backup);
    feedback.toast(
      error === null
        ? { tone: "success", text: "Yedek yüklendi." }
        : { tone: "error", text: error },
    );
  };

  return (
    <div className={`${styles.tab} ${styles.narrow}`}>
      {backupStale && (
        <Banner tone="warn">
          Son yedek 7 günden eski ya da hiç alınmadı. Tarayıcı verisi silinirse fiyatlar ve
          siparişler kaybolur.
        </Banner>
      )}

      <section className={styles.box}>
        <h3>Yedek al</h3>
        <p className={styles.note}>
          Son yedek: {lastBackupAt === null ? "hiç alınmadı" : fmtStamp(lastBackupAt, nowIso)}
        </p>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={withCosts}
            onChange={(e) => setWithCosts(e.target.checked)}
          />
          Maliyetler dahil (dosya adında _MALIYETLI yazar; kimseyle paylaşmayın)
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={withImages}
            onChange={(e) => setWithImages(e.target.checked)}
          />
          Yüklediğim görseller dahil
        </label>
        <button
          type="button"
          className="btnPrimary"
          onClick={() => {
            onExport(withCosts, withImages);
            feedback.toast({ tone: "success", text: "Yedek dosyası indirildi." });
          }}
        >
          <Icon icon={FileExportIcon} size={18} /> Yedek dosyasını indir
        </button>
      </section>

      <section className={styles.box}>
        <h3>Yedek yükle</h3>
        <p className={styles.note}>
          Başka cihazdan alınan yedeği seçin. Önce özet gösterilir; onaylamazsanız hiçbir şey
          değişmez.
        </p>
        <label className="btn">
          <Icon icon={FileImportIcon} size={18} /> Dosya seç
          <input
            type="file"
            accept="application/json,.json"
            className="srOnly"
            onChange={(e) => {
              void readFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </section>

      <section className={styles.box}>
        <h3>Depo</h3>
        <p className={styles.note}>
          Bu cihazda kullanılan: {fmtBytes(usageBytes)} (sınır genelde ~5 MB)
        </p>
        <button
          type="button"
          className="btnDanger"
          onClick={async () => {
            const ok = await feedback.confirm({
              title: "Başlangıç verisine sıfırlansın mı?",
              message:
                "Ürünler, fiyatlar, maliyetler ve görseller başlangıç verisine döner. Siparişler ve ayarlar kalır. Önce yedek almanızı öneririm.",
              confirmLabel: "Sıfırla",
              danger: true,
            });
            if (!ok) return;
            onResetSeed();
            feedback.toast({ tone: "success", text: "Başlangıç verisine dönüldü." });
          }}
        >
          <Icon icon={RefreshIcon} size={18} /> Başlangıç verisine sıfırla
        </button>
      </section>
    </div>
  );
}
