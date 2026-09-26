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
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
