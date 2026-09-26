import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { Cancel01Icon, MinusSignIcon, PlusSignIcon } from "@hugeicons/core-free-icons";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { MAX_QTY } from "../../domain/cart/cart.ts";
import {
  moneyInputStep,
  parseMoneyInput,
  parseQtyInput,
  parseRateInput,
  phoneInput,
  qtyInput,
  rateToInput,
} from "../../domain/input/parse.ts";
import type { MinorAmount, Rate } from "../../domain/abacus/index.ts";
import { moneyToInput } from "./format.ts";
import styles from "./parts.module.css";

export function Icon({ icon, size = 18 }: { icon: IconSvgElement; size?: number }) {
  return <HugeiconsIcon icon={icon} size={size} strokeWidth={1.8} aria-hidden="true" />;
}

/** Adet: − / + ve dokununca sayısal klavye. */
export function Stepper({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (qty: number) => void;
  label: string;
}) {
  const [draft, setDraft] = useState(value === 0 ? "" : String(value));
  useEffect(() => setDraft(value === 0 ? "" : String(value)), [value]);

  const commit = (raw: string) => {
    const parsed = parseQtyInput(raw);
    if (parsed === null || parsed > MAX_QTY) {
      setDraft(value === 0 ? "" : String(value));
      return;
    }
    onChange(parsed);
  };

  return (
    <div className={value > 0 ? `${styles.stepper} ${styles.stepperOn}` : styles.stepper}>
      <button
        type="button"
        aria-label={`${label} azalt`}
        disabled={value === 0}
        onClick={() => onChange(value - 1)}
      >
        <Icon icon={MinusSignIcon} size={16} />
      </button>
      <input
        aria-label={`${label} adet`}
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="0"
        value={draft}
        onChange={(e) => setDraft(qtyInput(e.target.value))}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      <button
        type="button"
        aria-label={`${label} artır`}
        disabled={value >= MAX_QTY}
        onClick={() => onChange(value + 1)}
      >
        <Icon icon={PlusSignIcon} size={16} />
      </button>
    </div>
  );
}

/** Görsel yoksa nötr gri yer tutucu: çapraz şerit (PRD §5.8; renk seçici kaldırıldı). */
export function ProductImage({
  src,
  title,
  onOpen,
}: {
  src: string | null;
  title: string;
  onOpen?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const shown = src !== null && !failed;
  const body = shown ? (
    <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
  ) : (
    <svg viewBox="0 0 120 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="120" height="120" fill="#f4f5f7" />
      <path d="M-10 92 L130 20" stroke="#c3c8d2" strokeWidth="14" />
      <path d="M58 -10 L92 130" stroke="#d4d8e0" strokeWidth="9" />
    </svg>
  );
  if (onOpen && shown) {
    return (
      <button
        type="button"
        className={styles.thumb}
        onClick={onOpen}
        aria-label={`${title} görselini büyüt`}
      >
        {body}
      </button>
    );
  }
  return (
    <span className={styles.thumb} role="img" aria-label={title}>
      {body}
    </span>
  );
}

/**
 * Arka plana dokununca kapatma — yalnız basma ve bırakma İKİSİ de arka plandaysa.
 * Kutunun içinde basılıp (metin seçerken) dışarıda bırakılan fare pencereyi kapatmaz.
 */
export function useBackdropClose(onClose: () => void) {
  const pressedOnBackdrop = useRef(false);
  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      pressedOnBackdrop.current = e.target === e.currentTarget;
    },
    onClick: (e: MouseEvent<HTMLElement>) => {
      const fromBackdrop = pressedOnBackdrop.current && e.target === e.currentTarget;
      pressedOnBackdrop.current = false;
      if (fromBackdrop) onClose();
    },
  };
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

/** Büyük görsel: arka plan kararır; X, dışarı dokunma ya da Esc kapatır. */
export function Lightbox({
  src,
  title,
  subtitle,
  onClose,
}: {
  src: string;
  title: string;
  subtitle?: string;
  onClose: () => void;
}) {
  useEscape(onClose);
  const backdrop = useBackdropClose(onClose);
  return (
    <div
      className={styles.lightbox}
      {...backdrop}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button type="button" className={styles.lightboxClose} onClick={onClose} aria-label="Kapat">
        <Icon icon={Cancel01Icon} size={22} />
      </button>
      <figure className={styles.lightboxFigure} onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={title} />
        <figcaption>
          <b>{title}</b>
          {subtitle !== undefined && <span>{subtitle}</span>}
        </figcaption>
      </figure>
    </div>
  );
}

/** Pencere kabuğu: ihale output.module.css ile aynı. */
export function Modal({
  title,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Kaydırılmayan alt çubuk (Vazgeç / Kaydet): içerik uzun olsa da hep görünür. */
  footer?: ReactNode;
  wide?: boolean;
}) {
  const id = useId();
  useEscape(onClose);
  const backdrop = useBackdropClose(onClose);
  return (
    <div className={styles.backdrop} {...backdrop}>
      <div
        className={wide ? `${styles.dialog} ${styles.dialogWide}` : styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.dialogHead}>
          <h2 id={id}>{title}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Kapat">
            <Icon icon={Cancel01Icon} size={18} />
          </button>
        </header>
        <div className={styles.dialogBody}>{children}</div>
        {footer !== undefined && <footer className={styles.dialogFoot}>{footer}</footer>}
      </div>
    </div>
  );
}

/**
 * Tutar/oran kutusunun ortak gövdesi — GHS-Panel MoneyInput ile aynı davranış:
 * reddedilen giriş kutuyu değiştirmez, altında kısa açıklama çıkar; çıkışta değer bildirilir.
 */
function StepField({
  shown,
  label,
  placeholder,
  suffix,
  onCommit,
}: {
  shown: string;
  label: string;
  placeholder: string;
  suffix: string;
  onCommit: (text: string) => void;
}) {
  const [draft, setDraft] = useState(shown);
  const [message, setMessage] = useState<string | null>(null);
  const messageId = useId();
  useEffect(() => setDraft(shown), [shown]);
  return (
    <span className={styles.affix}>
      <input
        type="text"
        aria-label={label}
        aria-invalid={message !== null}
        aria-describedby={message !== null ? messageId : undefined}
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        value={draft}
        className={styles.number}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const step = moneyInputStep(draft, e.target.value);
          if (!step.ok) {
            setMessage(step.message);
            return;
          }
          setMessage(null);
          setDraft(step.text);
        }}
        onBlur={() => {
          setMessage(null);
          onCommit(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      <span aria-hidden="true">{suffix}</span>
      {message !== null && (
        <small id={messageId} className={styles.inputHint} role="status">
          {message}
        </small>
      )}
    </span>
  );
}

/** Para kutusu: yalnız rakam ve virgül, binlik kendiliğinden; çıkışta kuruş. */
export function MoneyField({
  value,
  onCommit,
  label,
  placeholder = "",
}: {
  value: MinorAmount | null;
  onCommit: (minor: MinorAmount | null) => void;
  label: string;
  placeholder?: string;
}) {
  return (
    <StepField
      shown={moneyToInput(value)}
      label={label}
      placeholder={placeholder}
      suffix="₺"
      onCommit={(text) => onCommit(parseMoneyInput(text))}
    />
  );
}

/** Oran kutusu: "20", "20,5" (yüzde); çıkışta kesir. */
export function RateField({
  value,
  onCommit,
  label,
  placeholder = "",
}: {
  value: Rate | null;
  onCommit: (rate: Rate | null) => void;
  label: string;
  placeholder?: string;
}) {
  return (
    <StepField
      shown={value === null ? "" : rateToInput(value)}
      label={label}
      placeholder={placeholder}
      suffix="%"
      onCommit={(text) => onCommit(parseRateInput(text))}
    />
  );
}

/** Telefon kutusu: yalnız rakam, en çok 11 hane. */
export function PhoneField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (digits: string) => void;
  label: string;
}) {
  return (
    <input
      type="tel"
      inputMode="tel"
      autoComplete="off"
      aria-label={label}
      placeholder="05xx xxx xx xx"
      value={value}
      onChange={(e) => onChange(phoneInput(e.target.value))}
    />
  );
}

export function Banner({
  tone,
  children,
  action,
}: {
  tone: "info" | "warn" | "bad" | "good";
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={`${styles.banner} ${styles[tone]}`} role={tone === "bad" ? "alert" : "status"}>
      <span>{children}</span>
      {action}
    </div>
  );
}
