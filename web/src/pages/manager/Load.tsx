import {
  ComposedChart, Bar, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Flex } from "antd";
import { api } from "../../api/client";
import { useAsync } from "../../hooks/useAsync";
import { Card, Section, Skeleton, ErrorState } from "../../components/ui";
import { useColors } from "../../lib/colors";
import { fmtDate } from "../../lib/status";

export function Load() {
  const { data, loading, error, refetch } = useAsync(() => api.cohortLoad());
  const c = useColors();

  return (
    <Section>
      <Flex vertical gap={20}>
        <div>
          <h1 className="text-2xl font-bold t-text" style={{ letterSpacing: "-0.01em", margin: 0 }}>Projected weekly load</h1>
          <p className="text-sm t-muted" style={{ margin: 0 }}>Caregivers likely to need outreach each day, with a likely range.</p>
        </div>

        {loading ? (
          <Skeleton height="18rem" />
        ) : error || !data ? (
          <ErrorState message={error ?? "No data"} onRetry={refetch} />
        ) : (
          <>
            <Card className="p-4">
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={data.days} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={c.grid} />
                  <XAxis dataKey="date" tickFormatter={fmtDate} tickLine={false} axisLine={false}
                    tick={{ fill: c.muted, fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: c.muted, fontSize: 12 }} width={40} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "rgb(var(--accent) / 0.06)" }}
                    contentStyle={{ background: "rgb(var(--elevated))", border: "1px solid rgb(var(--border))", borderRadius: 12, color: "rgb(var(--text))", fontSize: 13 }}
                    labelFormatter={(l) => fmtDate(String(l))}
                    formatter={(v: unknown, name: string) => {
                      if (name === "band" && Array.isArray(v)) return [`${v[0]}–${v[1]}`, "likely range"];
                      return [v as number, "projected"];
                    }}
                  />
                  <Area dataKey={(d: { lower: number; upper: number }) => [d.lower, d.upper]} name="band"
                    stroke="none" fill={c.band} isAnimationActive />
                  <Bar dataKey="projected" fill={c.accent} radius={[4, 4, 0, 0]} barSize={26} isAnimationActive />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>
            <Card className="p-4">
              <div className="text-sm t-text">{data.staffing_hint}</div>
            </Card>
          </>
        )}
      </Flex>
    </Section>
  );
}
