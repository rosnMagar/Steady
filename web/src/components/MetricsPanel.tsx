import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, Maximize2 } from "lucide-react";
import { Row, Col } from "antd";
import type { Metric } from "../api/types";
import { useColors } from "../lib/colors";
import { Card } from "./ui";
import { fmtDate } from "../lib/status";
import { fmtValue } from "../lib/metricFormat";
import { MetricModal } from "./MetricModal";

const dirColorToken = { worse: "headsup", better: "steady", steady: "muted" } as const;

/** One metric: latest value, the person's own baseline, and a small baseline-referenced sparkline.
 * Clickable — opens an enlarged, interactive chart. */
function MetricTile({ m, onOpen }: { m: Metric; onOpen: () => void }) {
  const c = useColors();
  // Neutral metrics (e.g. steps) carry no good/bad judgment — show them plainly.
  const tone = m.neutral ? "steady" : m.direction;
  const stroke =
    tone === "worse" ? c.headsup : tone === "better" ? c.steady : c.muted;

  const w = 120, h = 36, pad = 3;
  const vals = m.series.map((p) => p.value);
  const lo = Math.min(...vals, m.baseline);
  const hi = Math.max(...vals, m.baseline);
  const span = hi - lo || 1;
  const x = (i: number) => pad + (i * (w - 2 * pad)) / (vals.length - 1 || 1);
  const y = (v: number) => h - pad - ((v - lo) / span) * (h - 2 * pad);
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const baseY = y(m.baseline);

  const delta = m.latest - m.baseline;
  // Text + arrow describe POSITION vs the baseline (above/below/in range); color carries good/bad.
  const inRange = !m.neutral && m.direction === "steady";
  const Arrow = inRange || Math.abs(delta) < 0.5 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
  const dirText = inRange ? "in your usual range"
    : delta > 0 ? "above your usual" : delta < 0 ? "below your usual" : "in your usual range";

  return (
    <button type="button" onClick={onOpen} aria-label={`Enlarge ${m.label} chart`}
      style={{ textAlign: "left", width: "100%", padding: 0, border: "none", background: "transparent", cursor: "pointer", borderRadius: "1.25rem" }}>
    <Card interactive className="p-3" style={{ height: "100%" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <span className="text-xs t-muted">{m.label}</span>
        {m.low_data
          ? <span className="t-muted" style={{ fontSize: "10px" }}>limited data</span>
          : <Maximize2 size={12} className="t-muted" aria-hidden style={{ flexShrink: 0 }} />}
      </div>
      <div style={{ marginTop: 4, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
        <div>
          <span className="text-xl font-semibold t-text">{fmtValue(m.key, m.latest)}</span>
          {m.unit && <span className="text-xs t-muted" style={{ marginLeft: 4 }}>{m.unit}</span>}
        </div>
        {!m.low_data && (
          <svg width={w} height={h} role="img"
            aria-label={`${m.label} last ${vals.length} days, latest ${fmtValue(m.key, m.latest)}`}>
            {/* the person's own baseline — the reference the value is judged against */}
            <line x1={pad} y1={baseY} x2={w - pad} y2={baseY}
              stroke={c.baseline} strokeWidth={1} strokeDasharray="3 3" />
            <polyline points={pts} fill="none" stroke={stroke} strokeWidth={2}
              strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={x(vals.length - 1)} cy={y(m.latest)} r={2.75} fill={stroke} />
          </svg>
        )}
      </div>
      <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 4, fontSize: "0.75rem", color: `rgb(var(--${dirColorToken[tone]}))` }}>
        <Arrow size={13} />
        <span>{dirText}</span>
        <span className="t-muted">· usual {fmtValue(m.key, m.baseline)}{m.unit && ` ${m.unit}`}</span>
      </div>
    </Card>
    </button>
  );
}

/** The daily signals behind the status. `dense` uses a tighter 2-col grid (drawer). */
export function MetricsPanel({ metrics, asOf, dense = false, possessive = "your" }: {
  metrics: Metric[];
  asOf: string | null;
  dense?: boolean;
  possessive?: "your" | "their";
}) {
  const [open, setOpen] = useState<Metric | null>(null);
  if (!metrics.length) return null;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
        <span className="text-sm font-medium t-text">The signals behind this</span>
        {asOf && <span className="text-xs t-muted">as of {fmtDate(asOf)}</span>}
      </div>
      <Row gutter={[8, 8]}>
        {metrics.map((m) => (
          <Col key={m.key} xs={12} sm={dense ? 12 : 8}>
            <MetricTile m={m} onOpen={() => setOpen(m)} />
          </Col>
        ))}
      </Row>
      <p className="t-muted" style={{ marginTop: 8, fontSize: "11px" }}>
        Tap any signal to enlarge. Daily aggregates from {possessive} wearable, compared with {possessive} own recent baseline. Not a clinical measurement.
      </p>
      {open && <MetricModal metric={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
