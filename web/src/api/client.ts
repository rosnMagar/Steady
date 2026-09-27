// Data layer. Defaults to mock JSON so the UI works with no backend.
// Set VITE_USE_API=1 (with the FastAPI server running) to hit real endpoints.
import type {
  Today, HeadsUp, CohortSummary, CohortRow, CohortLoad, CohortDetail, Methods, Metrics,
  ProgramsCatalog,
} from "./types";

import today from "../mocks/today.json";
import headsup from "../mocks/headsup.json";
import metricsMock from "../mocks/metrics.json";
import cohortSummary from "../mocks/cohort_summary.json";
import cohortCaregivers from "../mocks/cohort_caregivers.json";
import cohortLoad from "../mocks/cohort_load.json";
import cohortDetail from "../mocks/cohort_detail.json";
import methods from "../mocks/methods.json";
import programsCatalog from "../mocks/programs.json";

const USE_API = import.meta.env.VITE_USE_API === "1";

// Simulate a little latency so loading states are visible in dev.
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function mock<T>(data: unknown, ms = 350): Promise<T> {
  await delay(ms);
  return data as T;
}

async function real<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export const api = {
  today: (id: string) =>
    USE_API ? real<Today>(`/api/caregivers/${id}/today`) : mock<Today>(today),
  headsup: (id: string) =>
    USE_API ? real<HeadsUp>(`/api/caregivers/${id}/headsup`) : mock<HeadsUp>(headsup),
  metrics: (id: string) =>
    USE_API ? real<Metrics>(`/api/caregivers/${id}/metrics`) : mock<Metrics>(metricsMock),
  cohortSummary: () =>
    USE_API ? real<CohortSummary>(`/api/cohort/summary`) : mock<CohortSummary>(cohortSummary),
  cohortCaregivers: () =>
    USE_API
      ? real<{ caregivers: CohortRow[] }>(`/api/cohort/caregivers`).then((d) => d.caregivers)
      : mock<CohortRow[]>((cohortCaregivers as { caregivers: CohortRow[] }).caregivers),
  cohortLoad: () =>
    USE_API ? real<CohortLoad>(`/api/cohort/load-forecast`) : mock<CohortLoad>(cohortLoad),
  cohortDetail: (id: string) =>
    USE_API ? real<CohortDetail>(`/api/cohort/caregivers/${id}`) : mock<CohortDetail>(cohortDetail),
  methods: () =>
    USE_API ? real<Methods>(`/api/methods`) : mock<Methods>(methods),
  programs: () =>
    USE_API ? real<ProgramsCatalog>(`/api/programs`) : mock<ProgramsCatalog>(programsCatalog),

  markContacted: (id: string) =>
    USE_API
      ? real<{ ok: boolean }>(`/api/cohort/caregivers/${id}/contacted`, { method: "POST" })
      : mock<{ ok: boolean }>({ ok: true }),
  outreachDraft: (id: string) =>
    USE_API
      ? real<{ draft: string }>(`/api/cohort/caregivers/${id}/outreach-draft`, { method: "POST" })
      : mock<{ draft: string }>(
          { draft: "Hi, this is your care team checking in. This past week may have been a heavier stretch than usual — would a short call about support options help? No pressure, we're just here for you." },
          700,
        ),
  feedback: (id: string, programId: string, helpful: boolean) =>
    USE_API
      ? real<{ ok: boolean }>(`/api/caregivers/${id}/feedback`, {
          method: "POST",
          body: JSON.stringify({ program_id: programId, helpful }),
        })
      : mock<{ ok: boolean }>({ ok: true }, 0),
};
