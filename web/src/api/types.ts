export type Status = "steady" | "building" | "heads_up";

export interface SeriesPoint {
  date: string;
  actual: number | null;
  forecast: number | null;
  lower: number | null;
  upper: number | null;
}

export interface Driver {
  label: string;
  detail: string;
  direction: "worse" | "better" | "steady";
}

export interface Program {
  program_id: string;
  name: string;
  org: string;
  why: string;
  description?: string;
  eligibility?: string;
  phone: string;
  url: string;
  tags: string[];
}

export interface CatalogProgram {
  program_id: string;
  name: string;
  org: string;
  description: string;
  eligibility: string;
  phone: string;
  url: string;
  tags: string[];
  category: string;
  crisis: boolean;
}

export interface ProgramsCatalog {
  programs: CatalogProgram[];
}

export interface SelfCareTip {
  title: string;
  body: string;
}

export interface Today {
  person_id: string;
  name: string;
  as_of: string;
  status: Status;
  baseline_ready: boolean;
  baseline_days_remaining: number;
  baseline: number;
  headline: string;
  series: SeriesPoint[];
  drivers: Driver[];
}

export interface HeadsUp {
  person_id: string;
  status: Status;
  note: string;
  note_disclaimer: string;
  programs: Program[];
  self_care: SelfCareTip[];
  self_care_disclaimer: string;
  crisis_note: string;
}

export interface CohortSummary {
  enrolled: number;
  steady: number;
  building: number;
  heads_up: number;
  contacted_this_week: number;
  updated_at: string;
}

export interface CohortRow {
  person_id: string;
  name: string;
  status: Status;
  strain_now: number;
  forecast_peak: number;
  trend: number[];
  region: string;
  last_contacted: string | null;
}

export interface LoadContributor {
  person_id: string;
  name: string;
  region: string;
  status: Status;
  prob: number;
}

export interface LoadDay {
  date: string;
  projected: number;
  lower: number;
  upper: number;
  by_status: Partial<Record<Status, number>>;
  contributors: LoadContributor[];
}

export interface ActualDay {
  date: string;
  count: number;
}

export interface CohortLoad {
  staffing_hint: string;
  days: LoadDay[];
  recent_actuals: ActualDay[];
  projected_total: number;
  actual_last_week: number;
}

export interface LoadInsight {
  insight: string;
  disclaimer: string;
  model: string | null;
}

export interface CohortDetail {
  person_id: string;
  name: string;
  status: Status;
  region: string;
  strain_now: number;
  baseline: number;
  series: SeriesPoint[];
  drivers: Driver[];
  manager_brief: string;
  brief_disclaimer: string;
  programs: Program[];
  contact_history: { date: string; by: string; note: string }[];
}

export interface MetricPoint {
  date: string;
  value: number;
}

export interface Metric {
  key: string;
  label: string;
  unit: string;
  latest: number;
  baseline: number | null;
  direction: "worse" | "better" | "steady";
  neutral: boolean;
  low_data: boolean;
  series: MetricPoint[];
}

export interface Metrics {
  person_id: string;
  as_of: string | null;
  metrics: Metric[];
}

export interface Methods {
  n_participants: number;
  n_participants_used: number;
  date_range: string;
  disclosure: string;
  data_sources: { name: string; use: string; license: string }[];
  backtest: { metric: string; model: number | null; naive_baseline: number | null; unit: string; note: string }[];
  known_limitations: string[];
}
