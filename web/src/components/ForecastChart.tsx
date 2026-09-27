import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";
import type { SeriesPoint } from "../api/types";
import { useColors, tooltipTheme } from "../lib/colors";
import { fmtDate } from "../lib/status";

/**
 * Single-entity time series: past `actual` (solid) → future `forecast` (dashed) with a shaded
 * 95% band, and the person's own baseline as a dashed reference line. No legend (one series).
 */
export function ForecastChart({ series, baseline, height = 220 }: {
  series: SeriesPoint[];
  baseline: number;
  height?: number;
}) {
  const c = useColors();
  const data = series.map((p) => ({
    date: p.date,
    actual: p.actual,
    forecast: p.forecast,
    band: p.lower != null && p.upper != null ? [p.lower, p.upper] : null,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
        <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="0" />
        <XAxis
          dataKey="date" tickFormatter={fmtDate} tickLine={false} axisLine={false}
          tick={{ fill: c.muted, fontSize: 12 }} minTickGap={24}
        />
        <YAxis
          domain={[0, 100]} ticks={[0, 50, 100]} tickLine={false} axisLine={false}
          tick={{ fill: c.muted, fontSize: 12 }} width={36}
        />
        <ReferenceLine
          y={baseline} stroke={c.baseline} strokeDasharray="4 4"
          label={{ value: "your usual", position: "insideBottomRight", fill: c.muted, fontSize: 11 }}
        />
        <Tooltip
          cursor={{ stroke: c.muted, strokeDasharray: "3 3" }}
          {...tooltipTheme}
          labelFormatter={(l) => fmtDate(String(l))}
          formatter={(val: unknown, name: string) => {
            if (name === "band" && Array.isArray(val)) return [`${val[0]}–${val[1]}`, "likely range"];
            if (val == null) return ["—", name];
            return [Math.round(Number(val)), name === "actual" ? "strain" : "forecast"];
          }}
        />
        <Area dataKey="band" stroke="none" fill={c.band} isAnimationActive connectNulls={false} />
        <Line
          dataKey="actual" stroke={c.accent} strokeWidth={2} dot={false} connectNulls
          isAnimationActive animationDuration={500}
        />
        <Line
          dataKey="forecast" stroke={c.accent} strokeWidth={2} strokeDasharray="5 4" dot={false}
          connectNulls isAnimationActive animationDuration={500}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
