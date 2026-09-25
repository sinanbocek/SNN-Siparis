import { Copy01Icon, Download04Icon, WhatsappIcon } from "@hugeicons/core-free-icons";
import { useId, useRef, useState } from "react";
import type { PngRenderer, ShareService } from "../../application/ports/devices.ts";
import type { PharmacyDraft } from "../../domain/cart/cart.ts";
import { canShare, orderFileName, type Order } from "../../domain/order/order.ts";
import { useFeedback } from "../parts/feedback.tsx";
import { Icon, Modal, PhoneField } from "../parts/parts.tsx";
import { ScaledSheet } from "./ScaledSheet.tsx";
import styles from "./sales.module.css";

interface Props {
  order: Order;
  /** Kutuların gösterdiği ham taslak (kırpılmaz; boşluk yazılabilsin). */
  pharmacy: PharmacyDraft;
  note: string;
  suggestions: readonly string[];
  share: ShareService;
  png: PngRenderer;
  onPharmacyChange: (pharmacy: PharmacyDraft) => void;
  onNoteChange: (note: string) => void;
  /** Paylaşım başarılı: sipariş "paylaşıldı" kaydedilir, sepet sıfırlanır. */
  onShared: (order: Order) => void;
  onClose: () => void;
  editing: boolean;
}

/** Siparişi tamamla (PRD §4-D, §5.5): form + canlı PNG önizlemesi + paylaşım. */
export function CheckoutDialog({
  order,
  pharmacy,
  note,
  suggestions,
  share,
  png,
  onPharmacyChange,
  onNoteChange,
  onShared,
  onClose,
  editing,
}: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [busy, setBusy] = useState(false);
  const feedback = useFeedback();
  const ready = canShare(order.pharmacy, order.lines.length);
  const p = pharmacy;
  const set = (patch: Partial<PharmacyDraft>) => onPharmacyChange({ ...p, ...patch });

  const produce = async (): Promise<Blob | null> => {
    if (!sheetRef.current) return null;
    try {
      return await png.render(sheetRef.current);
    } catch {
      feedback.toast({ tone: "error", text: "Resim üretilemedi. Tekrar deneyin." });
      return null;
    }
  };

  const onShare = async () => {
    if (!ready || busy) return;
    setBusy(true);
    const blob = await produce();
    if (blob) {
      const outcome = await share.sharePng(blob, orderFileName(order), order.headerTitle);
      if (outcome.kind === "shared") onShared(order);
      else if (outcome.kind === "fallback") {
        feedback.toast({
          tone: "info",
          text: outcome.copied
            ? "Resim indirildi ve panoya kopyalandı. WhatsApp Web'de depo sohbetine yapıştırın."
            : "Resim indirildi. WhatsApp Web'de depo sohbetine dosyayı ekleyin.",
        });
        onShared(order);
      } else if (outcome.kind === "failed")
        feedback.toast({ tone: "error", text: outcome.message });
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
      feedback.toast(
        ok
          ? { tone: "success", text: "Resim panoya kopyalandı." }
          : { tone: "error", text: "Bu tarayıcı resmi panoya kopyalayamıyor." },
      );
    }
    setBusy(false);
  };

  return (
    <Modal
      title={editing ? `${order.no} · siparişi güncelle` : "Siparişi tamamla"}
      onClose={onClose}
      wide
    >
      <div className={styles.checkout}>
        <form className={styles.checkoutForm} onSubmit={(e) => e.preventDefault()}>
          <label className="field">
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
          <label className="field">
            <span>İl / ilçe</span>
            <input value={p.district} onChange={(e) => set({ district: e.target.value })} />
          </label>
          <label className="field">
            <span>Adres</span>
            <input value={p.address} onChange={(e) => set({ address: e.target.value })} />
          </label>
          <label className="field">
            <span>Telefon</span>
            <PhoneField
              label="Eczane telefonu"
              value={p.phone}
              onChange={(phone) => set({ phone })}
            />
          </label>
          <label className="field">
            <span>Not</span>
            <textarea value={note} onChange={(e) => onNoteChange(e.target.value)} />
          </label>

          <div className={styles.shareButtons}>
            <button
              type="button"
              className={`btnPrimary ${styles.whatsapp}`}
              disabled={!ready || busy}
              onClick={onShare}
            >
              <Icon icon={WhatsappIcon} /> {busy ? "Hazırlanıyor…" : "WhatsApp ile paylaş"}
            </button>
            <button type="button" className="btn" disabled={!ready || busy} onClick={onDownload}>
              <Icon icon={Download04Icon} size={16} /> PNG indir
            </button>
            <button type="button" className="btn" disabled={!ready || busy} onClick={onCopy}>
              <Icon icon={Copy01Icon} size={16} /> Kopyala
            </button>
          </div>
          {!ready && <p className="hint">Paylaşmak için eczane adını yazın.</p>}
        </form>
        <div className={styles.checkoutPreview} aria-label="Sipariş resmi önizlemesi">
          <ScaledSheet order={order} sheetRef={sheetRef} />
        </div>
      </div>
    </Modal>
  );
}
