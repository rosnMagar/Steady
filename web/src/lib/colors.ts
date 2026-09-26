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
