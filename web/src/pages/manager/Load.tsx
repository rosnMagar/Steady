import { useMemo, useState } from "react";
import {
  ComposedChart, Bar, Area, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer, Legend,
} from "recharts";
import { Flex, Segmented, InputNumber, Row, Col } from "antd";
import { ArrowUp, ArrowDown, Minus, ChevronRight, TriangleAlert, Sparkles } from "lucide-react";
import { api } from "../../api/client";
import { useAsync } from "../../hooks/useAsync";
import { Card, Section, StatTile, StatusChip, Skeleton, ErrorState, Disclaimer } from "../../components/ui";
import { CaregiverDrawer } from "./CaregiverDrawer";
import { useColors } from "../../lib/colors";
import { fmtDate } from "../../lib/status";
import type { LoadDay } from "../../api/types";

const CAP_KEY = "steady.capacity";

function readCapacity(): number | null {
  try {
    const v = localStorage.getItem(CAP_KEY);
    return v == null ? null : Number(v);
  } catch {
    return null;
  }
}

type Mode = "total" | "status";

/** Cortex-written read on this week's projected load. Loads on its own so a warehouse
 *  cold start never holds up the chart. */
function InsightCard() {
  const { data, loading, error } = useAsync(() => api.loadInsight());
  return (
    <Card className="p-4">
      <Flex align="center" gap={8} style={{ marginBottom: 8 }}>
        <Sparkles className="t-accent" size={18} />
        <div className="font-semibold t-text">What this week looks like</div>
      </Flex>
      {loading ? (
        <Flex vertical gap={8}>
          <Skeleton height="0.9rem" /><Skeleton height="0.9rem" /><Skeleton height="0.9rem" width="70%" />
        </Flex>
      ) : error || !data ? (
        <div className="text-sm t-muted">Insight unavailable right now.</div>
      ) : (
        <>
          <p className="text-sm t-text" style={{ lineHeight: 1.6, margin: 0 }}>{data.insight}</p>
          <div style={{ marginTop: 10 }}>
            <Disclaimer>{data.disclaimer}{data.model ? ` · ${data.model}` : ""}</Disclaimer>
          </div>
        </>
      )}
    </Card>
  );
}

export function Load() {
  const { data, loading, error, refetch } = useAsync(() => api.cohortLoad());
  const c = useColors();
  const [mode, setMode] = useState<Mode>("total");
  const [capacity, setCapacity] = useState<number | null>(() => readCapacity());
  const [selected, setSelected] = useState<string | null>(null); // selected day (date)
  const [drawer, setDrawer] = useState<string | null>(null); // opened caregiver

  const setCap = (v: number | null) => {
    setCapacity(v);
    try {
      if (v == null) localStorage.removeItem(CAP_KEY);
      else localStorage.setItem(CAP_KEY, String(v));
    } catch { /* ignore */ }
  };

  // Combined timeline: past actual outreach + future projection, on one axis.
  const chart = useMemo(() => {
    if (!data) return [];
    const past = data.recent_actuals.map((a) => ({ date: a.date, actual: a.count }));
    const future = data.days.map((d) => ({
      date: d.date,
      projected: d.projected,
      band: [d.lower, d.upper] as [number, number],
      heads_up: d.by_status.heads_up ?? 0,
      building: d.by_status.building ?? 0,
      steady: d.by_status.steady ?? 0,
    }));
    return [...past, ...future];
  }, [data]);

  const peakDay = useMemo<LoadDay | null>(() => {
    if (!data || data.days.length === 0) return null;
    return data.days.reduce((a, b) => (b.projected > a.projected ? b : a));
  }, [data]);

  const activeDay = useMemo<LoadDay | null>(() => {
    if (!data) return null;
    return data.days.find((d) => d.date === selected) ?? peakDay;
  }, [data, selected, peakDay]);

  const overCapacityDays = useMemo(
    () => (capacity == null || !data ? 0 : data.days.filter((d) => d.projected > capacity).length),
    [data, capacity],
  );

  const regionBreakdown = useMemo(() => {
    if (!activeDay) return [];
    const by: Record<string, number> = {};
    for (const ctr of activeDay.contributors) by[ctr.region] = (by[ctr.region] ?? 0) + ctr.prob;
    return Object.entries(by)
      .map(([region, load]) => ({ region, load: Math.round(load * 10) / 10 }))
      .sort((a, b) => b.load - a.load)
      .slice(0, 5);
  }, [activeDay]);

  const delta = data ? data.projected_total - data.actual_last_week : 0;

  const tooltipStyle = {
    background: "rgb(var(--elevated))", border: "1px solid rgb(var(--border))",
    borderRadius: 12, color: "rgb(var(--text))", fontSize: 13,
  };

  return (
    <Section>
      <Flex vertical gap={20}>
        <div>
          <h1 className="text-2xl font-bold t-text" style={{ letterSpacing: "-0.01em", margin: 0 }}>Projected weekly load</h1>
          <p className="text-sm t-muted" style={{ margin: 0 }}>Caregivers likely to need outreach each day, with a likely range and who's driving it.</p>
        </div>

        {loading ? (
          <Skeleton height="24rem" />
        ) : error || !data ? (
          <ErrorState message={error ?? "No data"} onRetry={refetch} />
        ) : (
          <>
            {/* KPI row */}
            <Row gutter={[12, 12]} align="stretch">
              <Col xs={12} md={6}><StatTile label="Projected this week" value={data.projected_total} /></Col>
              <Col xs={12} md={6}>
                <StatTile label="Peak day" value={peakDay ? `${peakDay.projected} · ${fmtDate(peakDay.date)}` : "—"} tone="heads_up" />
              </Col>
              <Col xs={12} md={6}>
                <StatTile
                  label="vs last week's outreach"
                  value={
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {delta > 0 ? <ArrowUp size={16} /> : delta < 0 ? <ArrowDown size={16} /> : <Minus size={16} />}
                      {Math.abs(delta)}
                    </span>
                  }
                  tone={delta > 0 ? "building" : undefined}
                />
              </Col>
              <Col xs={12} md={6}>
                <StatTile
                  label="Days over capacity"
                  value={capacity == null ? "—" : overCapacityDays}
                  tone={overCapacityDays > 0 ? "heads_up" : undefined}
                />
              </Col>
            </Row>

            {/* Controls */}
            <Flex wrap gap={12} align="center" justify="space-between">
              <Segmented
                value={mode}
                onChange={(v) => setMode(v as Mode)}
                options={[{ label: "Total", value: "total" }, { label: "By status", value: "status" }]}
              />
              <Flex align="center" gap={8}>
                <span className="text-sm t-muted">Team capacity / day</span>
                <InputNumber
                  min={0}
                  value={capacity ?? undefined}
                  onChange={(v) => setCap(v == null ? null : Number(v))}
                  placeholder="set"
                  style={{ width: 90 }}
                />
              </Flex>
            </Flex>

            {/* Chart */}
            <Card className="p-4">
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={chart} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}
                  onClick={(e: { activeLabel?: string }) => {
                    if (e?.activeLabel && data.days.some((d) => d.date === e.activeLabel)) setSelected(e.activeLabel);
                  }}>
                  <CartesianGrid vertical={false} stroke={c.grid} />
                  <XAxis dataKey="date" tickFormatter={fmtDate} tickLine={false} axisLine={false}
                    tick={{ fill: c.muted, fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: c.muted, fontSize: 12 }} width={40} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "rgb(var(--accent) / 0.06)" }}
                    contentStyle={tooltipStyle}
                    labelFormatter={(l) => fmtDate(String(l))}
                    formatter={(v: unknown, name: string) => {
                      if (name === "band" && Array.isArray(v)) return [`${v[0]}–${v[1]}`, "likely range"];
                      const labels: Record<string, string> = {
                        actual: "actual outreach", projected: "projected",
                        heads_up: "heads-up", building: "building", steady: "may cross",
                      };
                      return [v as number, labels[name] ?? name];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {/* Past: actual outreach */}
                  <Bar dataKey="actual" name="actual outreach" fill={c.muted} radius={[4, 4, 0, 0]} barSize={22} isAnimationActive={false} />
                  {mode === "total" ? (
                    <>
                      <Area dataKey="band" name="band" stroke="none" fill={c.band} isAnimationActive />
                      <Bar dataKey="projected" name="projected" radius={[4, 4, 0, 0]} barSize={22}>
                        {chart.map((d, i) => {
                          const over = capacity != null && (d as { projected?: number }).projected != null && (d as { projected: number }).projected > capacity;
                          const isSel = activeDay?.date === d.date;
                          return <Cell key={i} fill={over ? c.headsup : c.accent} opacity={isSel ? 1 : 0.82} cursor="pointer" />;
                        })}
                      </Bar>
                    </>
                  ) : (
                    <>
                      <Bar dataKey="heads_up" name="heads_up" stackId="s" fill={c.headsup} barSize={22} />
                      <Bar dataKey="building" name="building" stackId="s" fill={c.building} barSize={22} />
                      <Bar dataKey="steady" name="steady" stackId="s" fill={c.steady} barSize={22} radius={[4, 4, 0, 0]} />
                    </>
                  )}
                  {capacity != null && (
                    <ReferenceLine y={capacity} stroke={c.headsup} strokeDasharray="4 4"
                      label={{ value: `capacity ${capacity}`, position: "right", fill: c.muted, fontSize: 11 }} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
              <div className="text-xs t-muted" style={{ marginTop: 8 }}>
                Left of the gap is actual outreach logged; right is the 7-day projection. Tap a projected bar to see who's driving it.
              </div>
            </Card>

            {capacity != null && overCapacityDays > 0 && (
              <Card className="p-4" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <TriangleAlert className="t-headsup" size={20} style={{ marginTop: 2, flexShrink: 0 }} />
                <div className="text-sm t-text">
                  {overCapacityDays} {overCapacityDays === 1 ? "day is" : "days are"} projected to exceed your team capacity of {capacity}. Consider lining up extra coverage mid-week.
                </div>
              </Card>
            )}

            {/* Drill-down: who's driving the selected/peak day */}
            {activeDay && (
              <Row gutter={[12, 12]}>
                <Col xs={24} md={14}>
                  <Card className="p-4">
                    <Flex align="center" justify="space-between" style={{ marginBottom: 8 }}>
                      <div className="font-semibold t-text">Driving {fmtDate(activeDay.date)}</div>
                      <div className="text-xs t-muted">{activeDay.contributors.length} likely · tap to open</div>
                    </Flex>
                    <Flex vertical gap={6}>
                      {activeDay.contributors.map((ctr) => (
                        <div
                          key={ctr.person_id}
                          onClick={() => setDrawer(ctr.person_id)}
                          className="load-contrib"
                          style={{
                            display: "flex", alignItems: "center", gap: 10, padding: "0.5rem 0.5rem",
                            borderRadius: 10, cursor: "pointer",
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="text-sm font-medium t-text" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ctr.name}</div>
                            <div className="text-xs t-muted">{ctr.region}</div>
                          </div>
                          <StatusChip status={ctr.status} size="sm" />
                          <div className="text-xs t-muted" style={{ width: 44, textAlign: "right" }}>{Math.round(ctr.prob * 100)}%</div>
                          <ChevronRight size={16} className="t-muted" />
                        </div>
                      ))}
                    </Flex>
                  </Card>
                </Col>
                <Col xs={24} md={10}>
                  <Flex vertical gap={12}>
                  <Card className="p-4">
                    <div className="font-semibold t-text" style={{ marginBottom: 8 }}>By region</div>
                    <Flex vertical gap={10}>
                      {regionBreakdown.map((r) => {
                        const max = regionBreakdown[0]?.load || 1;
                        return (
                          <div key={r.region}>
                            <Flex justify="space-between" className="text-xs t-muted" style={{ marginBottom: 2 }}>
                              <span>{r.region}</span><span>{r.load}</span>
                            </Flex>
                            <div style={{ height: 8, borderRadius: 4, background: "rgb(var(--border))" }}>
                              <div style={{ width: `${(r.load / max) * 100}%`, height: "100%", borderRadius: 4, background: c.accent }} />
                            </div>
                          </div>
                        );
                      })}
                    </Flex>
                  </Card>
                  <InsightCard />
                  </Flex>
                </Col>
              </Row>
            )}

            <Card className="p-4">
              <div className="text-sm t-text">{data.staffing_hint}</div>
            </Card>
          </>
        )}
      </Flex>

      {drawer && <CaregiverDrawer id={drawer} onClose={() => setDrawer(null)} />}
    </Section>
  );
}
