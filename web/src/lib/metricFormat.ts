/** Metrics whose fmtValue string already carries its unit (so callers must not append it again). */
export const UNIT_IN_VALUE = new Set(["minutesasleep", "sleep_efficiency", "steps"]);

/** Format a metric value for display (units differ per metric). Shared by the panel + enlarged modal. */
export function fmtValue(key: string, v: number): string {
  if (key === "minutesasleep") {
    const h = Math.floor(v / 60);
    const m = Math.round(v % 60);
    return `${h}h ${m}m`;
  }
  if (key === "sleep_efficiency") return `${Math.round(v)}%`;
  if (key === "steps") return Math.round(v).toLocaleString();
  return `${Math.round(v)}`;
}
