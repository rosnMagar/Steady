import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { Table, Input, Segmented, Row, Col, type TableColumnsType } from "antd";
import { api } from "../../api/client";
import { useAsync } from "../../hooks/useAsync";
import { Card, Section, StatTile, StatusChip, Skeleton, ErrorState } from "../../components/ui";
import { Sparkline } from "../../components/Sparkline";
import { CaregiverDrawer } from "./CaregiverDrawer";
import type { CohortRow, Status } from "../../api/types";
import { fmtDate } from "../../lib/status";

const FILTERS: { label: string; value: Status | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Heads-up", value: "heads_up" },
  { label: "Building", value: "building" },
  { label: "Steady", value: "steady" },
];

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

  const columns: TableColumnsType<CohortRow> = [
    {
      title: "Caregiver",
      render: (_, r) => (
        <div>
          <div className="font-medium t-text">{r.name}</div>
          <div className="text-xs t-muted">{r.region}</div>
        </div>
      ),
    },
    { title: "Status", render: (_, r) => <StatusChip status={r.status} size="sm" /> },
    { title: "7-day trend", render: (_, r) => <Sparkline values={r.trend} status={r.status} /> },
    { title: "Now", render: (_, r) => <span className="t-text">{r.strain_now}</span> },
    { title: "Peak", render: (_, r) => <span className="t-text">{r.forecast_peak}</span> },
    { title: "Last contact", render: (_, r) => <span className="t-muted">{r.last_contacted ? fmtDate(r.last_contacted) : "—"}</span> },
  ];

  return (
    <Section>
      <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div>
          <h1 className="text-2xl font-bold t-text" style={{ letterSpacing: "-0.01em", margin: 0 }}>Your caregivers</h1>
          <p className="text-sm t-muted" style={{ margin: 0 }}>Ranked by forecasted strain over the next 7 days.</p>
        </div>

        {summary.loading ? (
          <Row gutter={[12, 12]}>
            {Array.from({ length: 4 }).map((_, i) => <Col key={i} xs={12} md={6}><Skeleton height="5rem" /></Col>)}
          </Row>
        ) : summary.data ? (
          <Row gutter={[12, 12]} align="stretch">
            <Col xs={12} md={6}><StatTile label="Enrolled" value={summary.data.enrolled} /></Col>
            <Col xs={12} md={6}><StatTile label="Heads-up" value={summary.data.heads_up} tone="heads_up" /></Col>
            <Col xs={12} md={6}><StatTile label="Building" value={summary.data.building} tone="building" /></Col>
            <Col xs={12} md={6}><StatTile label="Contacted this week" value={summary.data.contacted_this_week} /></Col>
          </Row>
        ) : null}

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
          <Segmented value={filter} onChange={(v) => setFilter(v as Status | "all")} options={FILTERS} />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name…"
            prefix={<Search size={15} className="t-muted" />}
            allowClear
            style={{ width: "12rem", maxWidth: "100%" }}
          />
        </div>

        {rows.loading ? (
          <Skeleton height="16rem" />
        ) : rows.error ? (
          <ErrorState message={rows.error} onRetry={rows.refetch} />
        ) : filtered.length === 0 ? (
          <Card className="p-6 text-center t-muted">No caregivers match.</Card>
        ) : (
          <Card className="p-0" style={{ overflow: "hidden" }}>
            <Table<CohortRow>
              columns={columns}
              dataSource={filtered}
              rowKey="person_id"
              pagination={false}
              size="small"
              // Rows open the detail drawer, so they must behave like buttons for keyboard and
              // screen-reader users too — not just for the mouse.
              onRow={(record) => ({
                onClick: () => setSelected(record.person_id),
                onKeyDown: (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(record.person_id);
                  }
                },
                tabIndex: 0,
                role: "button",
                "aria-label": `Open ${record.name}, status ${record.status}`,
                style: { cursor: "pointer" },
              })}
            />
          </Card>
        )}

        {selected && <CaregiverDrawer id={selected} onClose={() => setSelected(null)} />}
      </div>
    </Section>
  );
}
