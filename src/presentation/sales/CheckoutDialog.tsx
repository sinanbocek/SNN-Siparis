import { Copy01Icon, Download04Icon, WhatsappIcon } from "@hugeicons/core-free-icons";
import { useId, useRef, useState } from "react";
import type { PngRenderer, ShareService } from "../../application/ports/devices.ts";
import type { PharmacyDraft } from "../../domain/cart/cart.ts";
import { canShare, orderFileName, type Order } from "../../domain/order/order.ts";
import { Icon, Modal } from "../parts/parts.tsx";
import { ScaledSheet } from "./ScaledSheet.tsx";
import styles from "./sales.module.css";

interface Props {
  order: Order;
  suggestions: readonly string[];
  share: ShareService;
  png: PngRenderer;
  onPharmacyChange: (pharmacy: PharmacyDraft) => void;
  onNoteChange: (note: string) => void;
  /** Paylaşım başarılı: sipariş "paylaşıldı" kaydedilir, sepet sıfırlanır. */
  onShared: (order: Order) => void;
  onClose: () => void;
}

/** Siparişi tamamla (PRD §4-D, §5.5): form + canlı PNG önizlemesi + paylaşım. */
export function CheckoutDialog({
  order,
  suggestions,
  share,
  png,
  onPharmacyChange,
  onNoteChange,
  onShared,
  onClose,
}: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const ready = canShare(order.pharmacy, order.lines.length);
  const p = order.pharmacy;
  const set = (patch: Partial<PharmacyDraft>) => onPharmacyChange({ ...p, ...patch });

  const produce = async (): Promise<Blob | null> => {
    if (!sheetRef.current) return null;
    try {
      return await png.render(sheetRef.current);
    } catch {
      setMessage("Resim üretilemedi. Tekrar deneyin.");
      return null;
    }
  };

  const onShare = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setMessage(null);
    const blob = await produce();
    if (blob) {
      const outcome = await share.sharePng(blob, orderFileName(order), order.headerTitle);
      if (outcome.kind === "shared") onShared(order);
      else if (outcome.kind === "fallback") {
        setMessage(
          outcome.copied
            ? "Resim indirildi ve panoya kopyalandı. WhatsApp Web'de depo sohbetine yapıştırın."
            : "Resim indirildi. WhatsApp Web'de depo sohbetine dosyayı ekleyin.",
        );
        onShared(order);
      } else if (outcome.kind === "failed") setMessage(outcome.message);
    }
    setBusy(false);
  };

  const onDownload = async () => {
    if (!ready || busy) return;
    setBusy(true);
    const blob = await produce();
    if (blob) share.download(blob, orderFileName(order));
    setBusy(false);
  };

  const onCopy = async () => {
    if (!ready || busy) return;
    setBusy(true);
    const blob = await produce();
    if (blob) {
      const ok = await share.copyImage(blob);
      setMessage(ok ? "Resim panoya kopyalandı." : "Bu tarayıcı resmi panoya kopyalayamıyor.");
    }
    setBusy(false);
  };

  return (
    <Modal title="Siparişi tamamla" onClose={onClose} wide>
      <div className={styles.checkout}>
        <form className={styles.checkoutForm} onSubmit={(e) => e.preventDefault()}>
          <label>
            <span>Eczane adı *</span>
            <input
              list={listId}
              autoComplete="off"
              value={p.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Şifa Eczanesi"
              required
            />
            <datalist id={listId}>
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <label>
            <span>İl / ilçe</span>
            <input value={p.district} onChange={(e) => set({ district: e.target.value })} />
          </label>
          <label>
            <span>Adres</span>
            <input value={p.address} onChange={(e) => set({ address: e.target.value })} />
          </label>
          <label>
            <span>Telefon</span>
            <input
              inputMode="tel"
              value={p.phone}
              onChange={(e) => set({ phone: e.target.value })}
            />
          </label>
          <label>
            <span>Not</span>
            <textarea value={order.note} onChange={(e) => onNoteChange(e.target.value)} />
          </label>

          {message !== null && <p className={styles.formMessage}>{message}</p>}

          <div className={styles.shareButtons}>
            <button
              type="button"
              className={styles.whatsapp}
              disabled={!ready || busy}
              onClick={onShare}
            >
              <Icon icon={WhatsappIcon} /> {busy ? "Hazırlanıyor…" : "WhatsApp ile paylaş"}
            </button>
            <button
              type="button"
              className={styles.ghost}
              disabled={!ready || busy}
              onClick={onDownload}
            >
              <Icon icon={Download04Icon} size={18} /> PNG indir
            </button>
            <button
              type="button"
              className={styles.ghost}
              disabled={!ready || busy}
              onClick={onCopy}
            >
              <Icon icon={Copy01Icon} size={18} /> Kopyala
            </button>
          </div>
          {!ready && <p className={styles.hint}>Paylaşmak için eczane adını yazın.</p>}
        </form>
        <div className={styles.checkoutPreview} aria-label="Sipariş resmi önizlemesi">
          <ScaledSheet order={order} sheetRef={sheetRef} />
        </div>
      </div>
    </Modal>
  );
}
