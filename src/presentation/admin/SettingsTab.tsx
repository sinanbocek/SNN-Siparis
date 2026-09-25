import type { Rate } from "../../domain/abacus/index.ts";
import { ROUNDING_STEPS, type Settings } from "../../domain/settings/settings.ts";
import { fmtMoney } from "../parts/format.ts";
import { RateField } from "../parts/parts.tsx";
import styles from "./admin.module.css";

interface Props {
  settings: Settings;
  onChange: (settings: Settings) => void;
}

const STEP_LABELS: Record<number, string> = {
  1: "Kuruş",
  100: "1 TL",
  500: "5 TL",
  1000: "10 TL",
};

/** Ayarlar: pazarlamacı, başlık, KDV, yuvarlama, eczacı varsayılanı, sipariş öneki. */
export function SettingsTab({ settings, onChange }: Props) {
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });
  const setRate = (key: "vatRate" | "defaultPharmacistMarkup") => (rate: Rate | null) => {
    if (rate === null || rate < 0) return;
    set({ [key]: rate });
  };

  return (
    <div className={`${styles.tab} ${styles.form} ${styles.narrow}`}>
      <label>
        <span>Pazarlamacı adı</span>
        <input value={settings.repName} onChange={(e) => set({ repName: e.target.value })} />
      </label>
      <label>
        <span>Pazarlamacı telefonu</span>
        <input
          inputMode="tel"
          value={settings.repPhone}
          onChange={(e) => set({ repPhone: e.target.value })}
        />
        <small className={styles.note}>
          Gerçek numara yalnız bu cihazda saklanır; kodda yer tutucu durur.
        </small>
      </label>
      <label>
        <span>Sipariş resmi başlığı</span>
        <input
          value={settings.headerTitle}
          onChange={(e) => set({ headerTitle: e.target.value })}
        />
      </label>
      <label>
        <span>Sipariş no öneki</span>
        <input
          className={styles.short}
          value={settings.orderPrefix}
          maxLength={6}
          onChange={(e) => set({ orderPrefix: e.target.value.replace(/[^A-Za-z0-9]/g, "") })}
        />
      </label>
      <div className={styles.row}>
        <label>
          <span>KDV oranı</span>
          <RateField label="KDV oranı" value={settings.vatRate} onCommit={setRate("vatRate")} />
        </label>
        <label>
          <span>Eczacı kârı (varsayılan)</span>
          <RateField
            label="Eczacı kârı"
            value={settings.defaultPharmacistMarkup}
            onCommit={setRate("defaultPharmacistMarkup")}
          />
        </label>
      </div>
      <label>
        <span>Yuvarlama adımı</span>
        <select
          value={settings.roundingStepMinor}
          onChange={(e) => set({ roundingStepMinor: Number(e.target.value) })}
        >
          {ROUNDING_STEPS.map((s) => (
            <option key={s} value={s}>
              {STEP_LABELS[s] ?? fmtMoney(s)}
            </option>
          ))}
        </select>
        <small className={styles.note}>
          Değişince maliyetten hesaplanan fiyatlar yeniden türetilir; sabit fiyatlar değişmez.
        </small>
      </label>
    </div>
  );
}
