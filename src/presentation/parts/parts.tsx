import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { MinusSignIcon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { useEffect, useId, useState, type ReactNode } from "react";
import { MAX_QTY } from "../../domain/cart/cart.ts";
import {
  parseMoneyInput,
  parseQtyInput,
  parseRateInput,
  rateToInput,
} from "../../domain/input/parse.ts";
import type { MinorAmount, Rate } from "../../domain/abacus/index.ts";
import { liveMoneyInput, moneyToInput } from "./format.ts";
import styles from "./parts.module.css";

export function Icon({ icon, size = 20 }: { icon: IconSvgElement; size?: number }) {
  return <HugeiconsIcon icon={icon} size={size} strokeWidth={1.8} aria-hidden="true" />;
}

/** Adet: büyük − / + ve dokununca sayısal klavye (≥ 48 px). */
export function Stepper({
  value,
  onChange,
  label,
  compact = false,
}: {
  value: number;
  onChange: (qty: number) => void;
  label: string;
  compact?: boolean;
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
    <div className={compact ? `${styles.stepper} ${styles.compact}` : styles.stepper}>
      <button
        type="button"
        aria-label={`${label} azalt`}
        disabled={value === 0}
        onClick={() => onChange(value - 1)}
      >
        <Icon icon={MinusSignIcon} size={18} />
      </button>
      <input
        aria-label={`${label} adet`}
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="0"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 4))}
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
        <Icon icon={PlusSignIcon} size={18} />
      </button>
    </div>
  );
}

/** Görsel yoksa aile rengiyle çizilmiş kutu: çapraz şerit + ad (PRD §5.8). */
export function ProductImage({
  src,
  color,
  accent,
  title,
  subtitle,
  size = "md",
}: {
  src: string | null;
  color: string;
  accent: string | null;
  title: string;
  subtitle?: string;
  size?: "sm" | "md";
}) {
  const [failed, setFailed] = useState(false);
  const cls = size === "sm" ? `${styles.image} ${styles.imageSm}` : styles.image;
  if (src !== null && !failed) {
    return (
      <div className={cls}>
        <img src={src} alt={title} loading="lazy" onError={() => setFailed(true)} />
      </div>
    );
  }
  return (
    <div className={cls} aria-label={title} role="img">
      <svg viewBox="0 0 120 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="120" height="120" fill="#f4f5f7" />
        <path d="M-10 92 L130 20" stroke={color} strokeWidth="14" opacity="0.85" />
        <path d="M58 -10 L92 130" stroke={color} strokeWidth="9" opacity="0.55" />
        {accent !== null && <path d="M-10 104 L130 32" stroke={accent} strokeWidth="3" />}
      </svg>
      {size === "md" && (
        <span className={styles.placeholderText}>
          <b style={{ color }}>{title}</b>
          {subtitle !== undefined && <small>{subtitle}</small>}
        </span>
      )}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const id = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className={styles.backdrop} onClick={onClose}>
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
            ×
          </button>
        </header>
        <div className={styles.dialogBody}>{children}</div>
      </div>
    </div>
  );
}

/** Para kutusu: canlı binlik ayraç, çıkışta kuruş. */
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
  const [draft, setDraft] = useState(moneyToInput(value));
  useEffect(() => setDraft(moneyToInput(value)), [value]);
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      placeholder={placeholder}
      value={draft}
      className={styles.field}
      onChange={(e) => setDraft(liveMoneyInput(e.target.value, draft))}
      onBlur={() => {
        const parsed = parseMoneyInput(draft);
        onCommit(parsed);
        setDraft(moneyToInput(parsed));
      }}
    />
  );
}

/** Oran kutusu: "%20", "20,5" okur; çıkışta kesir. */
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
  const shown = value === null ? "" : rateToInput(value);
  const [draft, setDraft] = useState(shown);
  useEffect(() => setDraft(shown), [shown]);
  return (
    <span className={styles.rateWrap}>
      <span aria-hidden="true">%</span>
      <input
        aria-label={label}
        inputMode="decimal"
        placeholder={placeholder}
        value={draft}
        className={styles.field}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d,.%]/g, ""))}
        onBlur={() => {
          const parsed = parseRateInput(draft);
          onCommit(parsed);
        }}
      />
    </span>
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
