import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";
import type { Metric } from "../api/types";
import { useColors } from "../lib/colors";
import { fmtDate } from "../lib/status";
import { fmtValue } from "../lib/metricFormat";

/** Enlarged, interactive view of one metric's daily history with the personal baseline. */
export function MetricModal({ metric, onClose }: { metric: Metric; onClose: () => void }) {
  const c = useColors();
  const tone = metric.neutral ? "steady" : metric.direction;
  const stroke = tone === "worse" ? c.headsup : tone === "better" ? c.steady : c.accent;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const delta = metric.latest - metric.baseline;
  const position = metric.neutral || metric.direction === "steady"
    ? (metric.neutral && Math.abs(delta) >= 0.5 ? (delta > 0 ? "above your usual" : "below your usual") : "in your usual range")
    : delta > 0 ? "above your usual" : "below your usual";

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-30 bg-black/40 flex items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} role="dialog" aria-modal="true" aria-label={`${metric.label} detail`}
      >
        <motion.div
          className="w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-xl p-5"
          initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }} transition={{ duration: 0.18 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-lg font-semibold text-text">{metric.label}</div>
              <div className="mt-0.5 text-sm text-muted">
                Now <span className="font-medium text-text">{fmtValue(metric.key, metric.latest)}{metric.unit && ` ${metric.unit}`}</span>
                {" · "}usual {fmtValue(metric.key, metric.baseline)}{metric.unit && ` ${metric.unit}`}
                {" · "}<span style={{ color: `rgb(var(--${tone === "worse" ? "headsup" : tone === "better" ? "steady" : "muted"}))` }}>{position}</span>
              </div>
            </div>
            <button onClick={onClose} aria-label="Close" className="p-2 text-muted hover:text-text"><X size={20} /></button>
          </div>

          <div className="mt-4">
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={metric.series} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis dataKey="date" tickFormatter={fmtDate} tickLine={false} axisLine={false}
                  tick={{ fill: c.muted, fontSize: 12 }} minTickGap={28} />
                <YAxis domain={["auto", "auto"]} tickLine={false} axisLine={false}
                  tick={{ fill: c.muted, fontSize: 12 }} width={44}
                  tickFormatter={(v: number) => fmtValue(metric.key, v)} />
                <ReferenceLine y={metric.baseline} stroke={c.baseline} strokeDasharray="4 4"
                  label={{ value: "usual", position: "insideTopRight", fill: c.muted, fontSize: 11 }} />
                <Tooltip
                  cursor={{ stroke: c.muted, strokeDasharray: "3 3" }}
                  contentStyle={{
                    background: "rgb(var(--elevated))", border: "1px solid rgb(var(--border))",
                    borderRadius: 12, color: "rgb(var(--text))", fontSize: 13,
                  }}
                  labelFormatter={(l) => fmtDate(String(l))}
                  formatter={(val: unknown) => [fmtValue(metric.key, Number(val)) + (metric.unit ? ` ${metric.unit}` : ""), metric.label]}
                />
                <Line dataKey="value" stroke={stroke} strokeWidth={2} dot={false}
                  isAnimationActive animationDuration={450} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-[11px] text-muted">
            Daily aggregates over the last {metric.series.length} days, against the person's own baseline. Not a clinical measurement.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
