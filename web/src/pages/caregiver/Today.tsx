import { Link } from "react-router-dom";
import { ArrowRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Flex } from "antd";
import { api } from "../../api/client";
import { useAsync } from "../../hooks/useAsync";
import { Card, Section, StatusChip, Skeleton, ErrorState } from "../../components/ui";
import { ForecastChart } from "../../components/ForecastChart";
import { MetricsPanel } from "../../components/MetricsPanel";
import { AiInsightCard } from "../../components/AiInsightCard";
import { STATUS } from "../../lib/status";
import type { Driver } from "../../api/types";

function DriverRow({ d, first }: { d: Driver; first: boolean }) {
  const Icon = d.direction === "worse" ? TrendingUp : d.direction === "better" ? TrendingDown : Minus;
  const color = d.direction === "worse" ? "t-headsup" : d.direction === "better" ? "t-steady" : "t-muted";
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "0.625rem 0", borderTop: first ? "none" : "1px solid rgb(var(--border))" }}>
      <Icon size={18} className={color} style={{ marginTop: 2 }} />
      <div>
        <div className="text-sm font-medium t-text">{d.label}</div>
        <div className="text-sm t-muted">{d.detail}</div>
      </div>
    </div>
  );
}

export function Today() {
  const { data, loading, error, refetch } = useAsync(() => api.today("p_demo"));
  const metrics = useAsync(() => api.metrics("p_demo"));
  const insight = useAsync(() => api.todayInsight("p_demo"));

  if (loading)
    return (
      <Flex vertical gap={16}>
        <Skeleton height="6rem" />
        <Skeleton height="14rem" />
        <Skeleton height="8rem" />
      </Flex>
    );
  if (error || !data) return <ErrorState message={error ?? "No data"} onRetry={refetch} />;

  if (!data.baseline_ready)
    return (
      <Section>
        <Card className="p-6 text-center">
          <div className="text-lg font-semibold t-text">Learning your baseline</div>
          <p className="text-sm t-muted" style={{ marginTop: "0.5rem" }}>
            Steady needs about two weeks of your normal rhythm before it can spot changes.
            About {data.baseline_days_remaining} days to go.
          </p>
        </Card>
      </Section>
    );

  const meta = STATUS[data.status];
  return (
    <Section>
      <Flex vertical gap={20}>
        <div>
          <div className="text-sm t-muted">Hi {data.name}, here's your week</div>
          <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: 12 }}>
            <h1 className="text-3xl font-bold t-text" style={{ letterSpacing: "-0.01em", margin: 0 }}>{meta.caregiverWord}</h1>
            <StatusChip status={data.status} />
          </div>
          <p className="t-muted" style={{ marginTop: "0.25rem", marginBottom: 0 }}>{data.headline}</p>
        </div>

        <Card className="p-4">
          <div className="text-sm font-medium t-text" style={{ marginBottom: "0.5rem" }}>Next 7 days</div>
          <ForecastChart series={data.series} baseline={data.baseline} />
        </Card>

        {/* Sits directly under the chart it describes, so it reads as the takeaway from the graph. */}
        <AiInsightCard
          data={insight.data}
          loading={insight.loading}
          error={insight.error}
          subtitle="what your week looks like"
        />

        <Card className="p-4">
          <div className="text-sm font-medium t-text">What's moving this</div>
          <div style={{ marginTop: "0.25rem" }}>
            {data.drivers.map((d, i) => <DriverRow key={d.label} d={d} first={i === 0} />)}
          </div>
        </Card>

        {metrics.data && metrics.data.metrics.length > 0 && (
          <MetricsPanel metrics={metrics.data.metrics} asOf={metrics.data.as_of} />
        )}

        {data.status !== "steady" && (
          <Link to="/app/headsup" className="no-underline">
            <Card interactive className="p-4" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span className="font-medium t-text">See support that fits you</span>
              <ArrowRight className="t-accent" size={20} />
            </Card>
          </Link>
        )}
      </Flex>
    </Section>
  );
}
