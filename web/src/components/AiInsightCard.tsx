import { Sparkles } from "lucide-react";
import { Flex } from "antd";
import { Card, Skeleton, Disclaimer } from "./ui";
import type { LoadInsight } from "../api/types";

/** Cortex-written read on the chart above it. Presentational only — each page fetches its own
 *  insight so a warehouse cold start never holds up the chart it sits under.
 *  Accent tint + leading rule so the AI read stands out from the plain data cards around it. */
export function AiInsightCard({ data, loading, error, subtitle }: {
  data: LoadInsight | null;
  loading: boolean;
  error?: string | null;
  subtitle?: string;
}) {
  return (
    <Card
      className="p-4"
      style={{
        background: "rgb(var(--accent) / 0.06)",
        borderLeft: "3px solid rgb(var(--accent-ink))",
      }}
    >
      <Flex align="center" gap={8} wrap style={{ marginBottom: 8 }}>
        <Sparkles className="t-accent" size={18} aria-hidden />
        <div className="font-semibold t-text">AI suggestion</div>
        {subtitle && <span className="text-xs t-muted">· {subtitle}</span>}
      </Flex>
      {loading ? (
        <Flex vertical gap={8}>
          <Skeleton height="0.9rem" /><Skeleton height="0.9rem" /><Skeleton height="0.9rem" width="70%" />
        </Flex>
      ) : error || !data ? (
        <div className="text-sm t-muted">Insight unavailable right now.</div>
      ) : (
        <>
          <p className="t-text" style={{ lineHeight: 1.65, margin: 0 }}>{data.insight}</p>
          <div style={{ marginTop: 10 }}>
            <Disclaimer>{data.disclaimer}{data.model ? ` · ${data.model}` : ""}</Disclaimer>
          </div>
        </>
      )}
    </Card>
  );
}
