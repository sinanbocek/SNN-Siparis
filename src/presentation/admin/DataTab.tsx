import { FileExportIcon, FileImportIcon, RefreshIcon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import {
  parseBackup,
  type BackupFile,
  type BackupSummary,
} from "../../application/admin/backup.ts";
import { fmtBytes, fmtStamp } from "../parts/format.ts";
import { Banner, Icon, Modal } from "../parts/parts.tsx";
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
  const [pending, setPending] = useState<{ backup: BackupFile; summary: BackupSummary } | null>(
    null,
  );
  const [message, setMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setMessage(null);
    const parsed = parseBackup(await file.text());
    if (!parsed.ok) {
      setMessage({ tone: "bad", text: `${parsed.message} Mevcut veri değişmedi.` });
      return;
    }
    setPending({ backup: parsed.backup, summary: parsed.summary });
  };

  return (
    <div className={`${styles.tab} ${styles.narrow}`}>
      {backupStale && (
        <Banner tone="warn">
          Son yedek 7 günden eski ya da hiç alınmadı. Tarayıcı verisi silinirse fiyatlar ve
          siparişler kaybolur.
        </Banner>
      )}
      {message !== null && <Banner tone={message.tone}>{message.text}</Banner>}

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
          onClick={() => onExport(withCosts, withImages)}
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
          onClick={() => {
            if (
              window.confirm(
                "Ürünler, fiyatlar, maliyetler ve görseller başlangıç verisine döner. Siparişler ve ayarlar kalır. Önce yedek almanızı öneririm. Devam edilsin mi?",
              )
            ) {
              onResetSeed();
            }
          }}
        >
          <Icon icon={RefreshIcon} size={18} /> Başlangıç verisine sıfırla
        </button>
      </section>

      {pending && (
        <Modal title="Yedek yüklensin mi?" onClose={() => setPending(null)}>
          <div className={styles.form}>
            <p>
              {[
                `${fmtStamp(pending.summary.exportedAt, nowIso)} tarihli yedek:`,
                `${pending.summary.families} aile,`,
                `${pending.summary.variants} ürün,`,
                pending.summary.costs > 0 ? `${pending.summary.costs} maliyet,` : "maliyet yok,",
                `${pending.summary.orders} sipariş,`,
                `${pending.summary.images} görsel.`,
              ].join(" ")}
            </p>
            <p className={styles.warnText}>
              Bu cihazdaki ürünler, fiyatlar, ayarlar ve siparişler yedektekiyle değiştirilecek.
              {pending.backup.costs === null &&
                " Yedekte maliyet yok; bu cihazdaki maliyetler korunur."}
            </p>
            <div className={styles.actions}>
              <button type="button" className="btn" onClick={() => setPending(null)}>
                Vazgeç
              </button>
              <button
                type="button"
                className="btnPrimary"
                onClick={() => {
                  const error = onImport(pending.backup);
                  setPending(null);
                  setMessage(
                    error === null
                      ? { tone: "good", text: "Yedek yüklendi." }
                      : { tone: "bad", text: error },
                  );
                }}
              >
                Yükle
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
