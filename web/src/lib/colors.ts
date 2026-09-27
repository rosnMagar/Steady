import { useEffect, useState } from "react";
import { useTheme } from "./theme";

/** Resolve a design token (e.g. "accent") to a concrete rgb() string for SVG/Recharts. */
function read(token: string, alpha = 1): string {
  if (typeof window === "undefined") return "#0d9488";
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim();
  if (!raw) return "#0d9488";
  return alpha === 1 ? `rgb(${raw})` : `rgb(${raw} / ${alpha})`;
}

/** Recomputes token colors whenever the theme flips, so charts follow dark mode. */
export function useColors() {
  const { theme } = useTheme();
  const [c, setC] = useState(() => build());
  useEffect(() => setC(build()), [theme]);
  return c;
}

/** Shared Recharts tooltip styling.
 *
 * Recharts renders each tooltip ITEM in that series' own color, and our series colors are
 * fill-tuned tokens (e.g. --building #faad14) that sit at ~1.9:1 on the tooltip surface —
 * unreadable. `contentStyle` only styles the wrapper, so the item color has to be overridden
 * explicitly via `itemStyle`; spreading it last is what makes it win over Recharts' default. */
export const tooltipTheme = {
  contentStyle: {
    background: "rgb(var(--elevated))",
    border: "1px solid rgb(var(--border))",
    borderRadius: 12,
    fontSize: 13,
    boxShadow: "0 6px 20px rgb(0 0 0 / 0.18)",
    padding: "8px 12px",
  },
  itemStyle: { color: "rgb(var(--text))", padding: "2px 0" },
  labelStyle: { color: "rgb(var(--muted))", fontWeight: 600, marginBottom: 2 },
} as const;

function build() {
  return {
    accent: read("accent"),
    band: read("accent", 0.14),
    baseline: read("muted", 0.9),
    grid: read("border", 0.7),
    text: read("text"),
    muted: read("muted"),
    steady: read("steady"),
    building: read("building"),
    headsup: read("headsup"),
  };
}
