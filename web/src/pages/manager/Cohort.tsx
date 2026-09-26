import { useState, useMemo } from "react";
import { api } from "../../api/client";
import { useAsync } from "../../hooks/useAsync";
import { Card, Section, StatTile, StatusChip, Skeleton, ErrorState } from "../../components/ui";
import { Sparkline } from "../../components/Sparkline";
import { CaregiverDrawer } from "./CaregiverDrawer";
import type { CohortRow, Status } from "../../api/types";
import { fmtDate } from "../../lib/status";

const FILTERS: (Status | "all")[] = ["all", "heads_up", "building", "steady"];

export function Cohort() {
  const summary = useAsync(() => api.cohortSummary());
  const rows = useAsync(() => api.cohortCaregivers());
  const [filter, setFilter] = useState<Status | "all">("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const list = rows.data ?? [];
    return list
      .filter((r) => (filter === "all" ? true : r.status === filter))
      .filter((r) => r.name.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => b.forecast_peak - a.forecast_peak);
  }, [rows.data, filter, q]);

  return (
    <Section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text">Your caregivers</h1>
        <p className="text-sm text-muted">Ranked by forecasted strain over the next 7 days.</p>
      </div>

      {summary.loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : summary.data ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile label="Enrolled" value={summary.data.enrolled} />
          <StatTile label="Heads-up" value={summary.data.heads_up} tone="heads_up" />
          <StatTile label="Building" value={summary.data.building} tone="building" />
          <StatTile label="Contacted this week" value={summary.data.contacted_this_week} />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${
                filter === f ? "bg-accent-soft text-accent" : "text-muted hover:text-text"
              }`}>
              {f === "all" ? "All" : f.replace("_", "-")}
            </button>
          ))}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name…"
          className="px-3 py-2 rounded-lg border border-border bg-surface text-sm text-text w-48 max-w-full" />
      </div>

      {rows.loading ? (
        <Skeleton className="h-64" />
      ) : rows.error ? (
        <ErrorState message={rows.error} onRetry={rows.refetch} />
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted">No caregivers match.</Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-muted text-left border-b border-border">
              <tr>
                <th className="font-medium px-4 py-3">Caregiver</th>
                <th className="font-medium px-4 py-3">Status</th>
                <th className="font-medium px-4 py-3 hidden sm:table-cell">7-day trend</th>
                <th className="font-medium px-4 py-3">Now</th>
                <th className="font-medium px-4 py-3 hidden md:table-cell">Peak</th>
                <th className="font-medium px-4 py-3 hidden lg:table-cell">Last contact</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r: CohortRow) => (
                <tr key={r.person_id} onClick={() => setSelected(r.person_id)}
                  className="border-b border-border last:border-0 hover:bg-bg cursor-pointer">
                  <td className="px-4 py-3 font-medium text-text">{r.name}
                    <div className="text-xs text-muted font-normal">{r.region}</div></td>
                  <td className="px-4 py-3"><StatusChip status={r.status} size="sm" /></td>
                  <td className="px-4 py-3 hidden sm:table-cell"><Sparkline values={r.trend} status={r.status} /></td>
                  <td className="px-4 py-3 text-text">{r.strain_now}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-text">{r.forecast_peak}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted">
                    {r.last_contacted ? fmtDate(r.last_contacted) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {selected && <CaregiverDrawer id={selected} onClose={() => setSelected(null)} />}
    </Section>
  );
}
