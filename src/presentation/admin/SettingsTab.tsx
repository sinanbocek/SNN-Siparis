import { CheckmarkCircle02Icon, LockIcon, RefreshIcon } from "@hugeicons/core-free-icons";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { PricingState } from "../../application/admin/pricing.ts";
import {
  priceSettingsOf,
  previewPriceSettings,
  samePriceSettings,
  type PriceSettings,
  type PriceSettingsImpact,
} from "../../application/admin/settingsImpact.ts";
import type { UpdateCheck } from "../../application/ports/devices.ts";
import { text, type Rate } from "../../domain/abacus/index.ts";
import type { Catalog } from "../../domain/catalog/catalog.ts";
import { nextOrderNo } from "../../domain/order/order.ts";
import { ROUNDING_STEPS, type Settings } from "../../domain/settings/settings.ts";
import { useFeedback } from "../parts/feedback.tsx";
import { fmtMoney, fmtRate } from "../parts/format.ts";
import { Icon, PhoneField, RateField } from "../parts/parts.tsx";
import type { AppInfo } from "./AdminGate.tsx";
import styles from "./settings.module.css";

interface Props {
  settings: Settings;
  pricing: PricingState;
  app: AppInfo;
  today: string;
  /** Metin ayarları: her değişiklikte kaydedilir; hata mesajı ya da null. */
  onChange: (settings: Settings) => string | null;
  /** Fiyat ayarları + yeniden türetilen katalog; hata mesajı ya da null. */
  onPriceSave: (settings: Settings, catalog: Catalog) => string | null;
  onLock: () => void;
}

const STEP_LABELS: Record<number, string> = {
  1: "Kuruş",
  100: "1 TL",
  500: "5 TL",
  1000: "10 TL",
};

const SAVED_MS = 2000;

/**
 * Ayarlar (karar 2a, 26.09.2026): dört bölüm. Metin ayarları kendiliğinden kaydedilir;
 * fiyatı etkileyen ayarlar taslakta bekler, etki özeti gösterilir, "Kaydet" ile uygulanır.
 */
export function SettingsTab({
  settings,
  pricing,
  app,
  today,
  onChange,
  onPriceSave,
  onLock,
}: Props) {
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h2>Ayarlar</h2>
        <p>Bu cihazda geçerli ayarlar. Yedek dosyasına da girer.</p>
      </header>
      <ProfileSections settings={settings} today={today} onChange={onChange} />
      <PriceSection settings={settings} pricing={pricing} onPriceSave={onPriceSave} />
      <AppSection app={app} onLock={onLock} />
    </div>
  );
}

function Section({
  title,
  description,
  status,
  children,
}: {
  title: string;
  description: string;
  status?: ReactNode;
  children: ReactNode;
}) {
  const id = `settings-${title}`;
  return (
    <section className={styles.section} aria-labelledby={id}>
      <div className={styles.aside}>
        <h3 id={id}>
          {title}
          {status}
        </h3>
        <p>{description}</p>
      </div>
      <div className={styles.card}>{children}</div>
    </section>
  );
}

/** "✓ Kaydedildi": son değişiklikten sonra 2 sn görünür; hata varsa kalıcı kırmızı satır. */
function useSaveTrace() {
  const [state, setState] = useState<"idle" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const report = (result: string | null) => {
    setError(result);
    window.clearTimeout(timer.current);
    if (result !== null) {
      setState("idle");
      return;
    }
    setState("saved");
    timer.current = window.setTimeout(() => setState("idle"), SAVED_MS);
  };
  const badge =
    state === "saved" ? (
      <span className={styles.saved} role="status">
        <Icon icon={CheckmarkCircle02Icon} size={14} /> Kaydedildi
      </span>
    ) : null;
  const errorLine =
    error === null ? null : (
      <p className={styles.error} role="alert">
        {error}
      </p>
    );
  return { report, badge, errorLine };
}

function ProfileSections({
  settings,
  today,
  onChange,
}: {
  settings: Settings;
  today: string;
  onChange: (settings: Settings) => string | null;
}) {
  const rep = useSaveTrace();
  const sheet = useSaveTrace();
  const [prefixNote, setPrefixNote] = useState(false);
  const save = (trace: ReturnType<typeof useSaveTrace>, patch: Partial<Settings>) =>
    trace.report(onChange({ ...settings, ...patch }));

  const sample = nextOrderNo(settings.orderPrefix, today, []);

  return (
    <>
      <Section
        title="Pazarlamacı"
        description="Sipariş resminde ve üst şeritte görünür."
        status={rep.badge}
      >
        <label className={styles.field}>
          <span>Ad soyad</span>
          <input
            value={settings.repName}
            autoComplete="off"
            onChange={(e) => save(rep, { repName: e.target.value })}
          />
          {settings.repName.trim() === "" && (
            <small className={styles.warn}>Boş kalırsa sipariş resminde ad görünmez.</small>
          )}
        </label>
        <label className={styles.field}>
          <span>Telefon</span>
          <PhoneField
            label="Telefon"
            value={settings.repPhone}
            onChange={(repPhone) => save(rep, { repPhone })}
          />
          <small className={styles.note}>
            Numaranız yalnız bu cihazda saklanır; yedek dosyasına girer.
          </small>
        </label>
        {rep.errorLine}
      </Section>

      <Section
        title="Sipariş resmi"
        description="Depoya gönderilen resmin başlığı ve numarası."
        status={sheet.badge}
      >
        <label className={styles.field}>
          <span>Başlık</span>
          <input
            value={settings.headerTitle}
            autoComplete="off"
            onChange={(e) => save(sheet, { headerTitle: e.target.value })}
          />
          {settings.headerTitle.trim() === "" && (
            <small className={styles.warn}>Boş kalırsa resimde başlık görünmez.</small>
          )}
        </label>
        <label className={styles.field}>
          <span>Numara öneki</span>
          <input
            className={styles.prefix}
            value={settings.orderPrefix}
            maxLength={6}
            autoComplete="off"
            autoCapitalize="characters"
            onChange={(e) => {
              const raw = e.target.value;
              const clean = text.toAsciiUpper(raw.replace(/[^A-Za-z0-9]/g, ""));
              setPrefixNote(clean.length < raw.length);
              save(sheet, { orderPrefix: clean });
            }}
          />
          {prefixNote && (
            <small className={styles.warn}>Önekte yalnız harf ve rakam kullanılabilir.</small>
          )}
        </label>
        <div className={styles.preview} aria-label="Sipariş resmi önizlemesi">
          <span className={styles.previewTitle}>
            {settings.headerTitle.trim() === "" ? "—" : settings.headerTitle}
          </span>
          <span className={`num ${styles.previewNo}`}>{sample}</span>
        </div>
        {sheet.errorLine}
      </Section>
    </>
  );
}

function PriceSection({
  settings,
  pricing,
  onPriceSave,
}: {
  settings: Settings;
  pricing: PricingState;
  onPriceSave: (settings: Settings, catalog: Catalog) => string | null;
}) {
  const feedback = useFeedback();
  const saved = priceSettingsOf(settings);
  const [draft, setDraft] = useState<PriceSettings>(saved);
  const [vatKey, setVatKey] = useState(0);
  const [markupKey, setMarkupKey] = useState(0);
  const [emptyNote, setEmptyNote] = useState<string | null>(null);

  // Kayıtlı değer dışarıdan değişirse (Geri al, yedek) taslak ona döner.
  const { vatRate, defaultPharmacistMarkup, roundingStepMinor } = settings;
  useEffect(() => {
    setDraft({ vatRate, defaultPharmacistMarkup, roundingStepMinor });
  }, [vatRate, defaultPharmacistMarkup, roundingStepMinor]);

  // Geri al 10 sn sonra çağrılır: o anki ayar ve katalog üzerine uygulanır.
  const latest = useRef({ settings, catalog: pricing.catalog });
  latest.current = { settings, catalog: pricing.catalog };

  const dirty = !samePriceSettings(draft, saved);
  const impact = useMemo(
    () => (dirty ? previewPriceSettings(pricing, settings, draft) : null),
    [dirty, pricing, settings, draft],
  );

  const setRate =
    (key: "vatRate" | "defaultPharmacistMarkup", name: string, bump: () => void) =>
    (rate: Rate | null) => {
      if (rate === null) {
        bump();
        setEmptyNote(`${name} boş olamaz; ${fmtRate(draft[key], 0)} geri yüklendi.`);
        return;
      }
      setEmptyNote(null);
      setDraft((d) => ({ ...d, [key]: rate }));
    };

  const cancel = () => {
    setDraft(saved);
    setEmptyNote(null);
    setVatKey((k) => k + 1);
    setMarkupKey((k) => k + 1);
  };

  const save = () => {
    if (impact === null) return;
    const before = { price: saved, catalog: pricing.catalog };
    const error = onPriceSave({ ...settings, ...draft }, impact.next.catalog);
    if (error !== null) {
      feedback.toast({ text: error, tone: "error" });
      return;
    }
    setEmptyNote(null);
    feedback.toast({
      text: savedText(impact),
      tone: "success",
      action: {
        label: "Geri al",
        onClick: () => {
          const undoError = onPriceSave(
            { ...latest.current.settings, ...before.price },
            before.catalog,
          );
          feedback.toast(
            undoError === null
              ? { text: "Fiyat ayarları eski haline döndü.", tone: "info" }
              : { text: undoError, tone: "error" },
          );
        },
      },
    });
  };

  return (
    <Section
      title="Fiyat varsayılanları"
      description="Tüm ürünlerin fiyatını etkiler. Değişiklik Kaydet'e basınca uygulanır."
    >
      <div className={styles.rates}>
        <label className={styles.field}>
          <span>KDV oranı</span>
          <RateField
            key={`vat-${vatKey}`}
            label="KDV oranı"
            value={draft.vatRate}
            onCommit={setRate("vatRate", "KDV", () => setVatKey((k) => k + 1))}
          />
        </label>
        <label className={styles.field}>
          <span>Eczacı kârı</span>
          <RateField
            key={`markup-${markupKey}`}
            label="Eczacı kârı"
            value={draft.defaultPharmacistMarkup}
            onCommit={setRate("defaultPharmacistMarkup", "Eczacı kârı", () =>
              setMarkupKey((k) => k + 1),
            )}
          />
        </label>
      </div>
      {emptyNote !== null && (
        <small className={styles.warn} role="status">
          {emptyNote}
        </small>
      )}
      <div className={styles.field}>
        <span id="rounding-label">Yuvarlama</span>
        <div className={styles.segmented} role="radiogroup" aria-labelledby="rounding-label">
          {ROUNDING_STEPS.map((step) => (
            <button
              key={step}
              type="button"
              role="radio"
              aria-checked={draft.roundingStepMinor === step}
              onClick={() => setDraft((d) => ({ ...d, roundingStepMinor: step }))}
            >
              {STEP_LABELS[step] ?? fmtMoney(step)}
            </button>
          ))}
        </div>
        <small className={styles.note}>
          Alıştan hesaplanan fiyatlar ve Perakende Satış Fiyatı bu adıma yuvarlanır.
        </small>
      </div>

      {impact !== null && (
        <div className={styles.impact}>
          <ImpactSummary impact={impact} />
          <div className={styles.actions}>
            <button type="button" className="btn" onClick={cancel}>
              Vazgeç
            </button>
            <button type="button" className="btnPrimary" onClick={save}>
              Kaydet
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}

function ImpactSummary({ impact }: { impact: PriceSettingsImpact }) {
  const { priceChanged, vatAffected, fixedUntouched, example } = impact;
  return (
    <div className={styles.impactText} aria-live="polite">
      <strong>
        {priceChanged > 0
          ? `${priceChanged} ürünün fiyatı değişecek.`
          : "Hiçbir ürünün fiyatı değişmeyecek."}
      </strong>
      {example !== null && (
        <span>
          Örnek: {example.label} ({example.field === "sale" ? "Eczaneye Satışım" : "PSF"}){" "}
          <span className="num">{fmtMoney(example.beforeMinor)}</span> →{" "}
          <b className="num">{fmtMoney(example.afterMinor)}</b>
        </span>
      )}
      {vatAffected > 0 && (
        <span>{vatAffected} ürünün KDV'li tutarı değişecek; net fiyatlar aynı kalır.</span>
      )}
      {fixedUntouched > 0 && (
        <span>Sabit fiyatlı {fixedUntouched} ürünün Eczaneye Satışım fiyatı değişmez.</span>
      )}
    </div>
  );
}

function savedText(impact: PriceSettingsImpact): string {
  return impact.priceChanged > 0
    ? `Fiyat ayarları kaydedildi; ${impact.priceChanged} ürünün fiyatı güncellendi.`
    : "Fiyat ayarları kaydedildi.";
}

const CHECK_TEXT: Record<UpdateCheck, string> = {
  ready: 'Yeni sürüm iniyor; hazır olunca üstte "Yenile" düğmesi çıkar.',
  current: "Uygulama güncel.",
  failed: "Denetlenemedi. İnternet bağlantısını kontrol edin.",
  unavailable: "Bu tarayıcıda güncelleme denetlenemiyor.",
};

function AppSection({ app, onLock }: { app: AppInfo; onLock: () => void }) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<UpdateCheck | null>(null);
  const check = async () => {
    setChecking(true);
    setResult(await app.checkUpdates());
    setChecking(false);
  };
  return (
    <Section title="Güvenlik ve uygulama" description="Yönetim kilidi ve uygulama sürümü.">
      <div className={styles.line}>
        <div>
          <strong>Yönetim kilidi</strong>
          <small className={styles.note}>5 dakika işlem yapılmazsa kendiliğinden kilitlenir.</small>
        </div>
        <button type="button" className="btn" onClick={onLock}>
          <Icon icon={LockIcon} size={16} /> Şimdi kilitle
        </button>
      </div>
      <div className={styles.line}>
        <div>
          <strong>
            Sürüm <span className="num">{app.version}</span>
          </strong>
          {result !== null && !app.updateReady && (
            <small className={styles.note} role="status">
              {CHECK_TEXT[result]}
            </small>
          )}
          {app.updateReady && (
            <small className={styles.note}>Yeni sürüm hazır. Sepet ve tüm veri korunur.</small>
          )}
        </div>
        {app.updateReady ? (
          <button type="button" className="btnPrimary" onClick={app.applyUpdate}>
            <Icon icon={RefreshIcon} size={16} /> Yenile
          </button>
        ) : (
          <button type="button" className="btn" disabled={checking} onClick={() => void check()}>
            <Icon icon={RefreshIcon} size={16} />{" "}
            {checking ? "Denetleniyor…" : "Güncellemeleri denetle"}
          </button>
        )}
      </div>
    </Section>
  );
}
