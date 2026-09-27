import { Link } from "react-router-dom";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Table, Flex, type TableColumnsType } from "antd";
import { api } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { Card, Skeleton, ErrorState, Section } from "../components/ui";
import type { Methods as MethodsData } from "../api/types";

type BacktestRow = MethodsData["backtest"][number];

export function Methods() {
  const { data, loading, error, refetch } = useAsync(() => api.methods());

  const columns: TableColumnsType<BacktestRow> = [
    { title: "Metric", render: (_, b) => <span className="t-text">{b.metric} <span className="text-xs t-muted">({b.unit})</span></span> },
    { title: "Model", render: (_, b) => (b.model ?? <span className="t-muted" style={{ fontStyle: "italic" }}>pending</span>) },
    { title: "Naive baseline", render: (_, b) => <span className="t-muted">{b.naive_baseline ?? "—"}</span> },
  ];

  return (
    <div className="min-h-screen" style={{ background: "rgb(var(--bg))" }}>
      <div style={{ maxWidth: "48rem", margin: "0 auto", padding: "2rem 1.5rem" }}>
        <Link to="/" className="text-sm t-accent no-underline" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <ArrowLeft size={16} /> Back
        </Link>
        <h1 className="text-3xl font-bold t-text" style={{ letterSpacing: "-0.01em", marginTop: "1rem" }}>How Steady works &amp; its limits</h1>

        {loading ? (
          <Flex vertical gap={16} style={{ marginTop: "1.5rem" }}><Skeleton height="6rem" /><Skeleton height="10rem" /><Skeleton height="10rem" /></Flex>
        ) : error || !data ? (
          <div style={{ marginTop: "1.5rem" }}><ErrorState message={error ?? "No data"} onRetry={refetch} /></div>
        ) : (
          <Section>
            <Flex vertical gap={24} style={{ marginTop: "1.5rem" }}>
              <Card className="p-5" style={{ borderLeft: "4px solid rgb(var(--building))" }}>
                <div className="t-building font-medium" style={{ display: "flex", alignItems: "center", gap: 8 }}><AlertTriangle size={18} /> Read this first</div>
                <p className="text-sm t-text" style={{ marginTop: "0.5rem", lineHeight: 1.6, marginBottom: 0 }}>{data.disclosure}</p>
              </Card>

              <div>
                <h2 className="text-lg font-semibold t-text" style={{ marginBottom: "0.5rem" }}>Data sources</h2>
                <Flex vertical gap={8}>
                  {data.data_sources.map((s) => (
                    <Card key={s.name} className="p-4">
                      <div className="font-medium t-text">{s.name} <span className="text-xs t-muted">· {s.license}</span></div>
                      <div className="text-sm t-muted" style={{ marginTop: 2 }}>{s.use}</div>
                    </Card>
                  ))}
                </Flex>
              </div>

              <div>
                <h2 className="text-lg font-semibold t-text" style={{ marginBottom: "0.5rem" }}>Backtest</h2>
                <Card className="p-0" style={{ overflow: "hidden" }}>
                  <Table<BacktestRow>
                    columns={columns}
                    dataSource={data.backtest}
                    rowKey="metric"
                    pagination={false}
                    size="small"
                    footer={() => (
                      <span className="text-xs t-muted">
                        {data.n_participants_used} of {data.n_participants} participants used · {data.date_range}
                      </span>
                    )}
                  />
                </Card>
              </div>

              <div>
                <h2 className="text-lg font-semibold t-text" style={{ marginBottom: "0.5rem" }}>Known limitations</h2>
                <Flex vertical gap={6}>
                  {data.known_limitations.map((l) => (
                    <div key={l} className="text-sm t-text" style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <span className="t-building" style={{ marginTop: 2 }}>•</span> {l}
                    </div>
                  ))}
                </Flex>
              </div>
            </Flex>
          </Section>
        )}
      </div>
    </div>
  );
}
