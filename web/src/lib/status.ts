import type { Status } from "../api/types";

interface StatusMeta {
  label: string;
  colorVar: string;      // tailwind color name
  caregiverWord: string; // warm word shown to caregivers
  blurb: string;
}

export const STATUS: Record<Status, StatusMeta> = {
  steady: {
    label: "Steady",
    colorVar: "steady",
    caregiverWord: "Steady",
    blurb: "Things look about normal for you.",
  },
  building: {
    label: "Building",
    colorVar: "building",
    caregiverWord: "Building",
    blurb: "A few signs are trending up. Worth keeping an eye on.",
  },
  heads_up: {
    label: "Heads-up",
    colorVar: "headsup",
    caregiverWord: "Heads-up",
    blurb: "This could be a heavier stretch than usual.",
  },
};

export function fmtDate(iso: string): string {
  // Safari's Date parser is far stricter than Chrome's: anything that isn't a format it
  // recognises yields Invalid Date, which would render the literal string "Invalid Date".
  // Parse the Y-M-D parts explicitly (local midnight, so the day never shifts by timezone)
  // and fall back to the raw value rather than showing a broken date.
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  const d = m
    ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    : new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
