import { math, money } from "@snn/abacus-core";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import styles from "./reports.module.css";

/**
 * Piksel geometrisi düz aritmetikle (para değil); para ve oran ABACUS ile.
 * Rapor grafikleri — dataviz kuralları: tek eksen, ince işaretler (≤24 px sütun, 4 px yuvarlak
 * uç, taban düz), 2 px yüzey boşluğu, silik ızgara, seçici etiket, fareyle her dilimde ayrıntı.
 * Yazılar veri rengi taşımaz; renk yalnız işaretlerde.
 */

export const CHART_COLORS = {
  profit: "#3b5bdb",
  cost: "#c9ced8",
  uncosted: "#e4e7ed",
  line: "#3b5bdb",
} as const;

/** Eksen için kısa para: ₺1,5Mn · ₺950B (ABACUS; girdi kuruş). */
export function axisMoney(minor: number): string {
  if (minor === 0) return "₺0";
  // eslint-disable-next-line no-restricted-properties -- girdi kuruş (MinorAmount)
  return money.compact(minor, { style: "B/Mn/Mr" });
}

/** 0'dan başlayan temiz eksen adımları (1-2-5 × 10ⁿ). */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0 || count <= 0) return [0];
  const raw = max / count;
  const log = math.log10(raw);
  if (log === null) return [0, max];
  const base = math.pow(10, math.floor(log));
  if (base === null) return [0, max];
  const fraction = raw / base;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  const step = math.mul(niceFraction, base);
  const ticks: number[] = [];
  for (let v = 0; v < math.add(max, step); v = math.add(v, step)) ticks.push(v);
  return ticks;
}

function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setWidth(el.clientWidth > 0 ? el.clientWidth : fallback);
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [fallback]);
  return { ref, width };
}

export interface ColumnDatum {
  readonly key: string;
  readonly axisLabel: string;
  readonly tooltipTitle: string;
  readonly profit: number;
  readonly cost: number;
  readonly uncosted: number;
  readonly tooltip: ReactNode;
}

const HEIGHT = 260;
const PAD = { top: 12, right: 8, bottom: 28, left: 56 };
const GAP = 2;

/** Ciro sütunları: alt alış (gri), üst kâr (vurgu), en üst alışı girilmemiş (açık gri). */
export function RevenueColumns({ data }: { data: readonly ColumnDatum[] }) {
  const { ref, width } = useWidth<HTMLDivElement>(640);
  const [hover, setHover] = useState<number | null>(null);
  const totals = data.map((d) => math.add(math.add(d.cost, d.profit), d.uncosted));
  const max = totals.reduce((m, v) => (v > m ? v : m), 0);
  const ticks = niceTicks(max);
  const lastTick = ticks[ticks.length - 1];
  const top = lastTick === undefined || lastTick <= 0 ? 1 : lastTick;
  const plotW = math.sub(math.sub(width, PAD.left), PAD.right);
  const plotH = math.sub(math.sub(HEIGHT, PAD.top), PAD.bottom);
  const band = data.length > 0 ? plotW / data.length : plotW;
  const barW = math.round(band * 0.62 > 24 ? 24 : band * 0.62 < 3 ? 3 : band * 0.62, 1);
  const y = (v: number) => PAD.top + plotH - (top > 0 ? (v * plotH) / top : 0);
  const labelEvery = data.length <= 8 ? 1 : math.floor(data.length / 6);

  const segments = (d: ColumnDatum, i: number) => {
    const x = PAD.left + band * i + (band - barW) / 2;
    const parts = [
      { v: d.cost, color: CHART_COLORS.cost },
      { v: d.profit, color: CHART_COLORS.profit },
      { v: d.uncosted, color: CHART_COLORS.uncosted },
    ].filter((p) => p.v > 0);
    let base = 0;
    return parts.map((p, pi) => {
      const y0 = y(base);
      const y1 = y(base + p.v);
      base += p.v;
      const isTop = pi === parts.length - 1;
      const h = y0 - y1 - (isTop ? 0 : GAP);
      if (h <= 0) return null;
      const r = isTop ? (h < 4 ? h / 2 : 4) : 0;
      const d2 = isTop
        ? `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + barW - r} Q${x + barW},${y1} ${x + barW},${y1 + r} V${y0} Z`
        : `M${x},${y0} V${y0 - h} H${x + barW} V${y0} Z`;
      return <path key={pi} d={d2} fill={p.color} />;
    });
  };

  const hovered = hover === null ? null : data[hover];
  const tipLeft =
    hover === null
      ? 0
      : PAD.left + band * hover + band / 2 > width - 200
        ? PAD.left + band * hover - 196
        : PAD.left + band * hover + band / 2 + 12;

  return (
    <div ref={ref} className={styles.chartBox} onPointerLeave={() => setHover(null)}>
      <svg width={width} height={HEIGHT} role="img" aria-label="Dönem içinde ciro ve kâr">
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(t)}
              y2={y(t)}
              className={styles.grid}
            />
            <text x={PAD.left - 10} y={y(t)} className={styles.axisY}>
              {axisMoney(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => (
          <g key={d.key} opacity={hover === null || hover === i ? 1 : 0.45}>
            {segments(d, i)}
          </g>
        ))}
        {data.map((d, i) =>
          i % labelEvery === 0 ? (
            <text
              key={d.key}
              x={PAD.left + band * i + band / 2}
              y={HEIGHT - 8}
              className={styles.axisX}
            >
              {d.axisLabel}
            </text>
          ) : null,
        )}
        {data.map((d, i) => (
          <rect
            key={d.key}
            x={PAD.left + band * i}
            y={PAD.top}
            width={band}
            height={plotH}
            fill="transparent"
            tabIndex={0}
            aria-label={d.tooltipTitle}
            onPointerEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
          />
        ))}
      </svg>
      {hovered !== null && hovered !== undefined && (
        <div className={styles.tooltip} style={{ left: tipLeft, top: PAD.top }}>
          <b className={styles.tooltipTitle}>{hovered.tooltipTitle}</b>
          {hovered.tooltip}
        </div>
      )}
    </div>
  );
}

/** Tek çizgi eğilim (özet kartı). Son nokta vurgulu. */
export function Sparkline({ values }: { values: readonly number[] }) {
  const w = 120;
  const h = 32;
  if (values.length < 2) return <svg width={w} height={h} aria-hidden="true" />;
  const max = values.reduce((m, v) => (v > m ? v : m), 0);
  const step = (w - 4) / (values.length - 1);
  const yOf = (v: number) => (max <= 0 ? h - 3 : h - 3 - (v * (h - 6)) / max);
  const points = values.map((v, i) => `${2 + step * i},${yOf(v)}`);
  const last = values[values.length - 1];
  const lastY = last === undefined ? h - 3 : yOf(last);
  return (
    <svg width={w} height={h} aria-hidden="true" className={styles.spark}>
      <path
        d={`M${points.join(" L")} L${2 + step * (values.length - 1)},${h} L2,${h} Z`}
        fill={CHART_COLORS.line}
        opacity={0.08}
      />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={CHART_COLORS.line}
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={2 + step * (values.length - 1)}
        cy={lastY}
        r={3}
        fill={CHART_COLORS.line}
        stroke="#fff"
        strokeWidth={2}
      />
    </svg>
  );
}

export interface RankDatum {
  readonly key: string;
  readonly title: string;
  readonly subtitle?: string;
  /** Çubuk uzunluğu için değer; null = bilinmiyor (çubuk çizilmez). */
  readonly value: number | null;
  readonly valueLabel: string;
  readonly detail: string;
}

/** Sıralı yatay çubuklar: tek renk, değer ucunda, ayrıntı satırı her zaman görünür. */
export function RankBars({ data, empty }: { data: readonly RankDatum[]; empty: string }) {
  const max = data.reduce((m, d) => (d.value !== null && d.value > m ? d.value : m), 0);
  if (data.length === 0) return <p className={styles.muted}>{empty}</p>;
  return (
    <ol className={styles.rank}>
      {data.map((d, i) => {
        const pct = d.value === null || max <= 0 || d.value <= 0 ? 0 : (d.value / max) * 100;
        return (
          <li key={d.key} className={styles.rankRow}>
            <span className={styles.rankIndex}>{i + 1}</span>
            <span className={styles.rankMain}>
              <span className={styles.rankHead}>
                <span className={styles.rankTitle}>
                  <b>{d.title}</b>
                  {d.subtitle !== undefined && <small>{d.subtitle}</small>}
                </span>
                <span className={styles.rankValue}>{d.valueLabel}</span>
              </span>
              <span className={styles.rankTrack}>
                <span className={styles.rankBar} style={{ width: `${pct}%` }} />
              </span>
              <span className={styles.rankDetail}>{d.detail}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
