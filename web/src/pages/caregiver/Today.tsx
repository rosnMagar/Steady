import { Link } from "react-router-dom";
import { ArrowRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { api } from "../../api/client";
import { useAsync } from "../../hooks/useAsync";
import { Card, Section, StatusChip, Skeleton, ErrorState } from "../../components/ui";
import { ForecastChart } from "../../components/ForecastChart";
import { MetricsPanel } from "../../components/MetricsPanel";
import { STATUS } from "../../lib/status";
import type { Driver } from "../../api/types";

function DriverRow({ d }: { d: Driver }) {
  const Icon = d.direction === "worse" ? TrendingUp : d.direction === "better" ? TrendingDown : Minus;
  const color = d.direction === "worse" ? "text-headsup" : d.direction === "better" ? "text-steady" : "text-muted";
  return (
    <li className="flex items-start gap-3 py-2.5">
      <Icon size={18} className={`mt-0.5 ${color}`} />
      <div>
        <div className="text-sm font-medium text-text">{d.label}</div>
        <div className="text-sm text-muted">{d.detail}</div>
      </div>
    </li>
  );
}

export function Today() {
  const { data, loading, error, refetch } = useAsync(() => api.today("p_demo"));
  const metrics = useAsync(() => api.metrics("p_demo"));

  if (loading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-56" />
        <Skeleton className="h-32" />
      </div>
    );
  if (error || !data) return <ErrorState message={error ?? "No data"} onRetry={refetch} />;

  if (!data.baseline_ready)
    return (
      <Section>
        <Card className="p-6 text-center">
          <div className="text-lg font-semibold text-text">Learning your baseline</div>
          <p className="mt-2 text-sm text-muted">
            Steady needs about two weeks of your normal rhythm before it can spot changes.
            About {data.baseline_days_remaining} days to go.
          </p>
        </Card>
      </Section>
    );

  const meta = STATUS[data.status];
  return (
    <Section className="space-y-5">
      <div>
        <div className="text-sm text-muted">Hi {data.name}, here's your week</div>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-text">{meta.caregiverWord}</h1>
          <StatusChip status={data.status} />
        </div>
        <p className="mt-1 text-muted">{data.headline}</p>
      </div>

      <Card className="p-4">
        <div className="text-sm font-medium text-text mb-2">Next 7 days</div>
        <ForecastChart series={data.series} baseline={data.baseline} />
      </Card>

      <Card className="p-4">
        <div className="text-sm font-medium text-text">What's moving this</div>
        <ul className="mt-1 divide-y divide-border">
          {data.drivers.map((d) => <DriverRow key={d.label} d={d} />)}
        </ul>
      </Card>

      {metrics.data && metrics.data.metrics.length > 0 && (
        <MetricsPanel metrics={metrics.data.metrics} asOf={metrics.data.as_of} />
      )}

      {data.status !== "steady" && (
        <Link to="/app/headsup">
          <Card className="p-4 flex items-center justify-between hover:shadow-lg transition">
            <span className="font-medium text-text">See support that fits you</span>
            <ArrowRight className="text-accent" size={20} />
          </Card>
        </Link>
      )}
    </Section>
  );
}
