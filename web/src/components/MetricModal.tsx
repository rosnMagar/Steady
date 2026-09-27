import { useState } from "react";
import { Modal } from "antd";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";
import type { Metric } from "../api/types";
import { useColors } from "../lib/colors";
import { fmtDate } from "../lib/status";
import { fmtValue, UNIT_IN_VALUE } from "../lib/metricFormat";

/** Enlarged, interactive view of one metric's daily history with the personal baseline. */
export function MetricModal({ metric, onClose }: { metric: Metric; onClose: () => void }) {
  const c = useColors();
  const [open, setOpen] = useState(true);
  const tone = metric.neutral ? "steady" : metric.direction;
  const stroke = tone === "worse" ? c.headsup : tone === "better" ? c.steady : c.accent;

  const hasBaseline = metric.baseline != null;
  const delta = hasBaseline ? metric.latest - (metric.baseline as number) : 0;
  const unitSuffix = metric.unit && !UNIT_IN_VALUE.has(metric.key) ? ` ${metric.unit}` : "";
  const position = !hasBaseline ? "building your baseline"
    : metric.neutral || metric.direction === "steady"
    ? (metric.neutral && Math.abs(delta) >= 0.5 ? (delta > 0 ? "above your usual" : "below your usual") : "in your usual range")
    : delta > 0 ? "above your usual" : "below your usual";

  return (
    <Modal
      open={open}
      onCancel={() => setOpen(false)}
      afterClose={onClose}
      footer={null}
      width="min(100vw - 2rem, 42rem)"
      title={<span className="t-text font-semibold">{metric.label}</span>}
      styles={{ content: { background: "rgb(var(--surface))" }, header: { background: "rgb(var(--surface))" } }}
    >
      <div className="text-sm t-muted">
        Now <span className="font-medium t-text">{fmtValue(metric.key, metric.latest)}{unitSuffix}</span>
        {hasBaseline && <>{" · "}usual {fmtValue(metric.key, metric.baseline as number)}{unitSuffix}</>}
        {" · "}<span style={{ color: `rgb(var(--${tone === "worse" ? "headsup" : tone === "better" ? "steady" : "muted"}))` }}>{position}</span>
      </div>

      <div style={{ marginTop: "0.75rem" }}>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={metric.series} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} stroke={c.grid} />
            <XAxis dataKey="date" tickFormatter={fmtDate} tickLine={false} axisLine={false}
              tick={{ fill: c.muted, fontSize: 12 }} minTickGap={28} />
            <YAxis domain={["auto", "auto"]} tickLine={false} axisLine={false}
              tick={{ fill: c.muted, fontSize: 12 }} width={44}
              tickFormatter={(v: number) => fmtValue(metric.key, v)} />
            {hasBaseline && (
              <ReferenceLine y={metric.baseline as number} stroke={c.baseline} strokeDasharray="4 4"
                label={{ value: "usual", position: "insideTopRight", fill: c.muted, fontSize: 11 }} />
            )}
            <Tooltip
              cursor={{ stroke: c.muted, strokeDasharray: "3 3" }}
              contentStyle={{
                background: "rgb(var(--elevated))", border: "1px solid rgb(var(--border))",
                borderRadius: 12, color: "rgb(var(--text))", fontSize: 13,
              }}
              labelFormatter={(l) => fmtDate(String(l))}
              formatter={(val: unknown) => [fmtValue(metric.key, Number(val)) + unitSuffix, metric.label]}
            />
            <Line dataKey="value" stroke={stroke} strokeWidth={2} dot={false}
              isAnimationActive animationDuration={450} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="t-muted" style={{ marginTop: "0.75rem", fontSize: "11px" }}>
        Daily aggregates over the last {metric.series.length} days, against the person's own baseline. Not a clinical measurement.
      </p>
    </Modal>
  );
}
