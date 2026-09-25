import {
  Alert02Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Icon } from "./parts.tsx";
import styles from "./feedback.module.css";

/**
 * Ortak geri bildirim (proje sahibi 25.09.2026): tarayıcının `window.confirm` kutusu yerine
 * uygulamanın onay penceresi; işlem sonrası bilgi/uyarı için bildirim (toast).
 * Ekranlar yalnız `useFeedback()` çağırır; kendi mesaj kutusunu kurmaz.
 */

export type ToastTone = "success" | "info" | "error";

export interface ToastInput {
  readonly text: string;
  readonly tone?: ToastTone;
  /** Ör. "Geri al". */
  readonly action?: { readonly label: string; readonly onClick: () => void };
  /** ms; varsayılan 4000, düğmeli bildirimde 10000. */
  readonly duration?: number;
}

export interface ConfirmInput {
  readonly title: string;
  readonly message?: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  /** Geri alınamaz işlem: onay düğmesi kırmızı. */
  readonly danger?: boolean;
}

interface Feedback {
  toast(input: ToastInput): void;
  confirm(input: ConfirmInput): Promise<boolean>;
}

const FeedbackContext = createContext<Feedback | null>(null);

export function useFeedback(): Feedback {
  const value = useContext(FeedbackContext);
  if (value === null) throw new Error("useFeedback, FeedbackProvider içinde kullanılmalı.");
  return value;
}

interface ToastItem extends ToastInput {
  readonly id: number;
}

interface PendingConfirm extends ConfirmInput {
  readonly resolve: (ok: boolean) => void;
}

const TONE_ICON = {
  success: CheckmarkCircle02Icon,
  info: InformationCircleIcon,
  error: Alert02Icon,
} as const;

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<readonly ToastItem[]>([]);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = nextId.current;
      nextId.current = id + 1;
      // En çok 3 bildirim; eskisi düşer.
      setToasts((list) => [...list, { ...input, id }].slice(-3));
      const duration = input.duration ?? (input.action ? 10_000 : 4000);
      window.setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const confirm = useCallback(
    (input: ConfirmInput) =>
      new Promise<boolean>((resolve) => {
        setPending({ ...input, resolve });
      }),
    [],
  );

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  const close = (ok: boolean) => {
    if (pending === null) return;
    pending.resolve(ok);
    setPending(null);
  };

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <div className={styles.toasts} aria-live="polite">
        {toasts.map((t) => {
          const tone = t.tone ?? "info";
          return (
            <div key={t.id} className={`${styles.toast} ${styles[tone]}`} role="status">
              <Icon icon={TONE_ICON[tone]} size={18} />
              <span className={styles.toastText}>{t.text}</span>
              {t.action && (
                <button
                  type="button"
                  className={styles.toastAction}
                  onClick={() => {
                    t.action?.onClick();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
              <button
                type="button"
                className={styles.toastClose}
                aria-label="Bildirimi kapat"
                onClick={() => dismiss(t.id)}
              >
                <Icon icon={Cancel01Icon} size={14} />
              </button>
            </div>
          );
        })}
      </div>
      {pending !== null && <ConfirmDialog request={pending} onClose={close} />}
    </FeedbackContext.Provider>
  );
}

/** Onay penceresi: ihale ConfirmDialog ile aynı kabuk. Esc ve dışarı dokunma = vazgeç. */
function ConfirmDialog({
  request,
  onClose,
}: {
  request: ConfirmInput;
  onClose: (ok: boolean) => void;
}) {
  const titleId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={styles.backdrop} onClick={() => onClose(false)}>
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>{request.title}</h2>
        {request.message !== undefined && <p>{request.message}</p>}
        <div className={styles.actions}>
          <button type="button" className="btn" onClick={() => onClose(false)}>
            {request.cancelLabel ?? "Vazgeç"}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={request.danger ? `btnPrimary ${styles.danger}` : "btnPrimary"}
            onClick={() => onClose(true)}
          >
            {request.confirmLabel ?? "Tamam"}
          </button>
        </div>
      </div>
    </div>
  );
}
