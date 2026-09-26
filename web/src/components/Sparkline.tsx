import type { Status } from "../api/types";
import { useColors } from "../lib/colors";

/** Tiny inline trend line for the cohort list. Color follows the row's status. */
export function Sparkline({ values, status, width = 84, height = 28 }: {
  values: number[];
  status: Status;
  width?: number;
  height?: number;
}) {
  const c = useColors();
  const stroke = status === "heads_up" ? c.headsup : status === "building" ? c.building : c.steady;
  if (!values.length) return <svg width={width} height={height} aria-hidden />;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 2;
  const pts = values.map((v, i) => {
    const x = pad + (i * (width - 2 * pad)) / (values.length - 1 || 1);
    const y = height - pad - ((v - min) / span) * (height - 2 * pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg width={width} height={height} role="img" aria-label={`trend, latest ${values[values.length - 1]}`}>
      <polyline points={pts.join(" ")} fill="none" stroke={stroke} strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].split(",")[0]} cy={pts[pts.length - 1].split(",")[1]} r={2.5} fill={stroke} />
    </svg>
  );
}
