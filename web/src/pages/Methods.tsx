import { Link } from "react-router-dom";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { api } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { Card, Skeleton, ErrorState, Section } from "../components/ui";

export function Methods() {
  const { data, loading, error, refetch } = useAsync(() => api.methods());

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline">
          <ArrowLeft size={16} /> Back
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-text">How Steady works & its limits</h1>

        {loading ? (
          <div className="mt-6 space-y-4"><Skeleton className="h-24" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
        ) : error || !data ? (
          <div className="mt-6"><ErrorState message={error ?? "No data"} onRetry={refetch} /></div>
        ) : (
          <Section className="mt-6 space-y-6">
            <Card className="p-5 border-l-4 border-l-building">
              <div className="flex items-center gap-2 text-building font-medium"><AlertTriangle size={18} /> Read this first</div>
              <p className="mt-2 text-sm text-text leading-relaxed">{data.disclosure}</p>
            </Card>

            <div>
              <h2 className="text-lg font-semibold text-text mb-2">Data sources</h2>
              <div className="space-y-2">
                {data.data_sources.map((s) => (
                  <Card key={s.name} className="p-4">
                    <div className="font-medium text-text">{s.name} <span className="text-xs text-muted font-normal">· {s.license}</span></div>
                    <div className="text-sm text-muted mt-0.5">{s.use}</div>
                  </Card>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-text mb-2">Backtest</h2>
              <Card className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="text-muted text-left border-b border-border">
                    <tr><th className="font-medium px-4 py-3">Metric</th><th className="font-medium px-4 py-3">Model</th><th className="font-medium px-4 py-3">Naive baseline</th></tr>
                  </thead>
                  <tbody>
                    {data.backtest.map((b) => (
                      <tr key={b.metric} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 text-text">{b.metric} <span className="text-xs text-muted">({b.unit})</span></td>
                        <td className="px-4 py-3 text-text">{b.model ?? <span className="text-muted italic">pending</span>}</td>
                        <td className="px-4 py-3 text-muted">{b.naive_baseline ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-4 py-2 text-xs text-muted border-t border-border">
                  {data.n_participants_used} of {data.n_participants} participants used · {data.date_range}
                </div>
              </Card>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-text mb-2">Known limitations</h2>
              <ul className="space-y-1.5">
                {data.known_limitations.map((l) => (
                  <li key={l} className="flex items-start gap-2 text-sm text-text">
                    <span className="text-building mt-0.5">•</span> {l}
                  </li>
                ))}
              </ul>
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
