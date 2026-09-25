import {
  Alert02Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  GiftIcon,
  PackageIcon,
  Store01Icon,
  ChartIncreaseIcon,
} from "@hugeicons/core-free-icons";
import { date, math, money } from "@snn/abacus-core";
import { useMemo, useState } from "react";
import { demoCosts, demoOrders } from "../../application/admin/demoOrders.ts";
import {
  buildReport,
  changeRate,
  type BucketSize,
  type Report,
  type ReportPeriod,
  type ReportTotals,
} from "../../application/admin/reports.ts";
import type { Catalog } from "../../domain/catalog/catalog.ts";
import type { CostBook } from "../../domain/costs/costs.ts";
import type { Order } from "../../domain/order/order.ts";
import { fmtMoney, fmtRate } from "../parts/format.ts";
import { Icon } from "../parts/parts.tsx";
import { CHART_COLORS, RankBars, RevenueColumns, Sparkline, type ColumnDatum } from "./charts.tsx";
import styles from "./reports.module.css";

interface Props {
  orders: readonly Order[];
  catalog: Catalog;
  costs: CostBook;
  today: string;
  onGoPricing: () => void;
}

const PERIODS: readonly { id: ReportPeriod; label: string }[] = [
  { id: "week", label: "Bu hafta" },
  { id: "month", label: "Bu ay" },
  { id: "quarter", label: "Son 3 ay" },
  { id: "year", label: "Bu yıl" },
  { id: "all", label: "Tümü" },
];

const PREVIOUS_LABEL: Record<ReportPeriod, string> = {
  week: "geçen haftaya göre",
  month: "geçen ayın aynı günlerine göre",
  quarter: "önceki 3 aya göre",
  year: "geçen yılın aynı dönemine göre",
  all: "",
};

type RankMetric = "revenue" | "profit" | "qty";

function count(n: number): string {
  return money.fmtDecimalGrouped(n);
}

function rangeLabel(start: string, end: string): string {
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const left = sameYear ? date.format(start, "dayMonth") : date.format(start, "long");
  return `${left} – ${date.format(end, "long")}`;
}

function axisLabel(start: string, size: BucketSize): string {
  if (size === "month") return date.monthName(Number(start.slice(5, 7)), "short");
  return date.format(start, "dayMonth");
}

function bucketTitle(start: string, size: BucketSize): string {
  if (size === "month") return date.format(start.slice(0, 7), "monthYear");
  if (size === "week") return `${date.format(start, "dayMonth")} haftası`;
  return date.format(start, "dayMonthWeekday");
}

export function ReportsTab({ orders, catalog, costs, today, onGoPricing }: Props) {
  const [periodId, setPeriodId] = useState<ReportPeriod>("month");
  const [demo, setDemo] = useState(false);
  const [metric, setMetric] = useState<RankMetric>("revenue");

  const source = useMemo(
    () =>
      demo
        ? { orders: demoOrders(catalog, today), costs: demoCosts(catalog, costs) }
        : { orders, costs },
    [demo, orders, costs, catalog, today],
  );
  const report = useMemo(
    () => buildReport(source.orders, catalog, source.costs, periodId, today),
    [source, catalog, periodId, today],
  );
  const hasData = report.totals.orders > 0;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h2 className={styles.title}>Raporlar</h2>
          <p className={styles.subtitle}>
            {rangeLabel(report.plan.current.start, report.plan.current.end)}
            {demo && <span className={styles.demoPill}>Örnek veri</span>}
          </p>
        </div>
        <div className={styles.controls}>
          <div className="tabs" role="group" aria-label="Dönem">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={periodId === p.id}
                onClick={() => setPeriodId(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <label className={styles.demoToggle}>
            <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
            Örnek veriyle göster
          </label>
        </div>
      </header>

      {!hasData ? (
        <section className={`${styles.card} ${styles.empty}`}>
          <span className={styles.emptyIcon}>
            <Icon icon={ChartIncreaseIcon} size={22} />
          </span>
          <h3>Bu dönemde paylaşılan sipariş yok</h3>
          <p>
            Siparişler paylaşıldıkça ciro, kâr ve en çok satanlar burada görünür. Sayfanın nasıl
            görüneceğini görmek için örnek veriyi açabilirsiniz; örnek veri kaydedilmez.
          </p>
          {!demo && (
            <button type="button" className="btn" onClick={() => setDemo(true)}>
              Örnek veriyle göster
            </button>
          )}
        </section>
      ) : (
        <>
          <Kpis report={report} periodId={periodId} />
          <Insights report={report} onGoPricing={onGoPricing} />

          <section className={styles.card}>
            <div className={styles.cardHead}>
              <div>
                <h3>Ciro ve kâr</h3>
                <p className={styles.muted}>KDV hariç; her sütun eczaneye satışınızın tamamıdır</p>
              </div>
              <ul className={styles.legend}>
                <li>
                  <i style={{ background: CHART_COLORS.profit }} /> Kâr
                </li>
                <li>
                  <i style={{ background: CHART_COLORS.cost }} /> Alışım
                </li>
                {report.totals.uncostedRevenueMinor > 0 && (
                  <li>
                    <i style={{ background: CHART_COLORS.uncosted }} /> Alışı girilmemiş
                  </li>
                )}
              </ul>
            </div>
            <RevenueColumns data={columnData(report)} />
          </section>

          <div className={styles.split}>
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h3>En çok satanlar</h3>
                <div className="tabs" role="group" aria-label="Sıralama ölçütü">
                  {(
                    [
                      ["revenue", "Ciro"],
                      ["profit", "Kâr"],
                      ["qty", "Adet"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={metric === id}
                      onClick={() => setMetric(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <RankBars data={productRanks(report, metric)} empty="Ürün yok." />
            </section>

            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h3>Ürün grupları</h3>
                <p className={styles.muted}>Ciro payı</p>
              </div>
              <RankBars data={groupRanks(report)} empty="Ürün grubu yok." />
            </section>
          </div>

          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h3>Eczaneler</h3>
              <p className={styles.muted}>{count(report.totals.pharmacies)} eczane</p>
            </div>
            <PharmacyTable report={report} />
          </section>
        </>
      )}
    </div>
  );
}

function Delta({
  current,
  previous,
  periodId,
}: {
  current: number | null;
  previous: number | null;
  periodId: ReportPeriod;
}) {
  if (periodId === "all") return <span className={styles.deltaNone}>Tüm zamanlar</span>;
  const rate = changeRate(current, previous);
  if (rate === null) return <span className={styles.deltaNone}>Önceki dönemde veri yok</span>;
  const up = rate >= 0;
  return (
    <span className={up ? styles.deltaUp : styles.deltaDown}>
      <Icon icon={up ? ArrowUp01Icon : ArrowDown01Icon} size={14} />
      {money.percent(math.mul(rate, 100), 1, { sign: "never" })}
      <span className={styles.deltaNote}>{PREVIOUS_LABEL[periodId]}</span>
    </span>
  );
}

function Kpis({ report, periodId }: { report: Report; periodId: ReportPeriod }) {
  const t = report.totals;
  const p: ReportTotals | null = report.previous;
  const revenueSeries = report.buckets.map((b) => b.revenueMinor);
  const profitSeries = report.buckets.map((b) => b.profitMinor);
  const orderSeries = report.buckets.map((b) => b.orders);
  return (
    <section className={styles.kpis} aria-label="Özet">
      <article className={`${styles.kpi} ${styles.kpiHero}`}>
        <span className={styles.kpiLabel}>Ciro (KDV hariç)</span>
        <span className={styles.kpiValue}>{fmtMoney(t.revenueMinor)}</span>
        <Delta
          current={t.revenueMinor}
          previous={p === null ? null : p.revenueMinor}
          periodId={periodId}
        />
        <Sparkline values={revenueSeries} />
      </article>
      <article className={styles.kpi}>
        <span className={styles.kpiLabel}>Kâr</span>
        <span className={styles.kpiValue}>{fmtMoney(t.profitMinor)}</span>
        <span className={styles.kpiSub}>
          Marj {fmtRate(t.marginRate)}
          {t.uncostedRevenueMinor > 0 && " · bir kısmı hesaplanamadı"}
        </span>
        <Delta
          current={t.profitMinor}
          previous={p === null ? null : p.profitMinor}
          periodId={periodId}
        />
        <Sparkline values={profitSeries} />
      </article>
      <article className={styles.kpi}>
        <span className={styles.kpiLabel}>Sipariş</span>
        <span className={styles.kpiValue}>{count(t.orders)}</span>
        <span className={styles.kpiSub}>Ortalama {fmtMoney(t.avgOrderMinor)}</span>
        <Delta current={t.orders} previous={p === null ? null : p.orders} periodId={periodId} />
        <Sparkline values={orderSeries} />
      </article>
      <article className={styles.kpi}>
        <span className={styles.kpiLabel}>Satılan kutu</span>
        <span className={styles.kpiValue}>{count(t.boxes)}</span>
        <span className={styles.kpiSub}>
          +{count(t.mfBoxes)} MF · {count(t.pharmacies)} eczane
        </span>
        <Delta current={t.boxes} previous={p === null ? null : p.boxes} periodId={periodId} />
      </article>
    </section>
  );
}

function Insights({ report, onGoPricing }: { report: Report; onGoPricing: () => void }) {
  const t = report.totals;
  const items: {
    key: string;
    icon: typeof PackageIcon;
    text: string;
    action?: { label: string; run: () => void };
  }[] = [];
  const top = report.products[0];
  if (top && t.revenueMinor > 0) {
    const share = math.div(top.revenueMinor, t.revenueMinor);
    items.push({
      key: "top",
      icon: PackageIcon,
      text: `En çok satan ${top.groupName} ${top.variantName}: cironun ${fmtRate(share)} kadarı, ${count(top.qty)} kutu.`,
    });
  }
  const bestMargin = report.groups
    .filter((g) => g.profitMinor !== null && g.revenueMinor > 0)
    .map((g) => ({ g, margin: math.div(g.profitMinor as number, g.revenueMinor) }))
    .sort((a, b) => (b.margin === null ? 0 : b.margin) - (a.margin === null ? 0 : a.margin))[0];
  if (bestMargin && bestMargin.margin !== null) {
    items.push({
      key: "margin",
      icon: ChartIncreaseIcon,
      text: `En kârlı ürün grubu ${bestMargin.g.name}: marj ${fmtRate(bestMargin.margin)}.`,
    });
  }
  if (t.mfBoxes > 0 && t.profitMinor !== null && t.profitMinor > 0) {
    const share = math.div(t.mfCostMinor, t.profitMinor);
    items.push({
      key: "mf",
      icon: GiftIcon,
      text: `Bedava verilen ${count(t.mfBoxes)} kutunun alışı ${fmtMoney(t.mfCostMinor)}; MF olmasaydı kâr ${fmtRate(share)} daha yüksek olurdu.`,
    });
  }
  const best = report.pharmacies[0];
  if (best) {
    items.push({
      key: "pharmacy",
      icon: Store01Icon,
      text: `En çok alan eczane ${best.name}: ${count(best.orders)} sipariş, ${fmtMoney(best.revenueMinor)}.`,
    });
  }
  if (t.uncostedRevenueMinor > 0) {
    items.push({
      key: "uncosted",
      icon: Alert02Icon,
      text: `${fmtMoney(t.uncostedRevenueMinor)} cironun alış fiyatı girilmemiş; bu kısmın kârı hesaplanamadı.`,
      action: { label: "Fiyatlamaya git", run: onGoPricing },
    });
  }
  if (items.length === 0) return null;
  return (
    <section className={styles.insights} aria-label="Öne çıkanlar">
      {items.map((it) => (
        <p
          key={it.key}
          className={
            it.key === "uncosted" ? `${styles.insight} ${styles.insightNote}` : styles.insight
          }
        >
          <span className={styles.insightIcon}>
            <Icon icon={it.icon} size={16} />
          </span>
          <span>{it.text}</span>
          {it.action && (
            <button type="button" className={styles.insightAction} onClick={it.action.run}>
              {it.action.label}
            </button>
          )}
        </p>
      ))}
    </section>
  );
}

function columnData(report: Report): ColumnDatum[] {
  const size = report.plan.bucket;
  return report.buckets.map((b) => {
    const costed = math.sub(b.revenueMinor, b.uncostedRevenueMinor);
    const profitShown = b.profitMinor > 0 ? b.profitMinor : 0;
    const costShown = b.profitMinor > 0 ? b.costMinor : costed;
    return {
      key: b.start,
      axisLabel: axisLabel(b.start, size),
      tooltipTitle: bucketTitle(b.start, size),
      profit: profitShown,
      cost: costShown,
      uncosted: b.uncostedRevenueMinor,
      tooltip: (
        <dl className={styles.tipRows}>
          <div className={styles.tipStrong}>
            <dt>Ciro</dt>
            <dd>{fmtMoney(b.revenueMinor)}</dd>
          </div>
          <div>
            <dt>
              <i style={{ background: CHART_COLORS.profit }} />
              Kâr
            </dt>
            <dd>{costed > 0 ? fmtMoney(b.profitMinor) : "—"}</dd>
          </div>
          <div>
            <dt>
              <i style={{ background: CHART_COLORS.cost }} />
              Alışım
            </dt>
            <dd>{costed > 0 ? fmtMoney(b.costMinor) : "—"}</dd>
          </div>
          {b.uncostedRevenueMinor > 0 && (
            <div>
              <dt>
                <i style={{ background: CHART_COLORS.uncosted }} />
                Alışı girilmemiş
              </dt>
              <dd>{fmtMoney(b.uncostedRevenueMinor)}</dd>
            </div>
          )}
          <div>
            <dt>Sipariş</dt>
            <dd>{count(b.orders)}</dd>
          </div>
        </dl>
      ),
    };
  });
}

function productRanks(report: Report, metric: RankMetric) {
  const rows = [...report.products];
  const valueOf = (r: (typeof rows)[number]) =>
    metric === "revenue" ? r.revenueMinor : metric === "profit" ? r.profitMinor : r.qty;
  rows.sort((a, b) => {
    const va = valueOf(a);
    const vb = valueOf(b);
    if (va === null) return 1;
    if (vb === null) return -1;
    return vb - va;
  });
  return rows.slice(0, 8).map((r) => {
    const v = valueOf(r);
    const margin =
      r.profitMinor === null || r.revenueMinor <= 0
        ? null
        : math.div(r.profitMinor, r.revenueMinor);
    return {
      key: r.variantId,
      title: r.groupName,
      subtitle: r.variantName,
      value: v,
      valueLabel: metric === "qty" ? `${count(r.qty)} kutu` : fmtMoney(v),
      detail: [
        metric !== "revenue" ? fmtMoney(r.revenueMinor) : null,
        metric !== "qty" ? `${count(r.qty)} kutu` : null,
        r.mf > 0 ? `+${count(r.mf)} MF` : null,
        margin === null ? "kâr hesaplanamadı" : `marj ${fmtRate(margin)}`,
      ]
        .filter((x): x is string => x !== null)
        .join(" · "),
    };
  });
}

function groupRanks(report: Report) {
  const total = report.totals.revenueMinor;
  return report.groups.slice(0, 8).map((g) => {
    const share = total > 0 ? math.div(g.revenueMinor, total) : null;
    const margin =
      g.profitMinor === null || g.revenueMinor <= 0
        ? null
        : math.div(g.profitMinor, g.revenueMinor);
    return {
      key: g.key,
      title: g.name,
      value: g.revenueMinor,
      valueLabel: fmtRate(share),
      detail: [
        fmtMoney(g.revenueMinor),
        `${count(g.qty)} kutu`,
        margin === null ? "kâr hesaplanamadı" : `marj ${fmtRate(margin)}`,
      ].join(" · "),
    };
  });
}

function PharmacyTable({ report }: { report: Report }) {
  const rows = report.pharmacies.slice(0, 10);
  const total = report.totals.revenueMinor;
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Eczane</th>
            <th className="num">Sipariş</th>
            <th className="num">Ciro</th>
            <th className="num">Pay</th>
            <th className="num">Son sipariş</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td data-label="Eczane">
                <b>{r.name}</b>
              </td>
              <td className="num" data-label="Sipariş">
                {count(r.orders)}
              </td>
              <td className="num" data-label="Ciro">
                {fmtMoney(r.revenueMinor)}
              </td>
              <td className="num" data-label="Pay">
                {fmtRate(total > 0 ? math.div(r.revenueMinor, total) : null)}
              </td>
              <td className="num" data-label="Son sipariş">
                {date.format(r.lastDay, "dayMonth")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
