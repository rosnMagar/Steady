import { useState } from "react";
import { Phone, ExternalLink, Bookmark, ThumbsDown, LifeBuoy } from "lucide-react";
import { Flex } from "antd";
import { api } from "../../api/client";
import { useAsync } from "../../hooks/useAsync";
import { Card, Section, Skeleton, ErrorState, Button, Disclaimer } from "../../components/ui";
import type { Program } from "../../api/types";

function ProgramCard({ p }: { p: Program }) {
  const [feedback, setFeedback] = useState<"saved" | "not_helpful" | null>(null);
  return (
    <Card className="p-4">
      <div className="font-semibold t-text">{p.name}</div>
      <div className="text-xs t-muted">{p.org}</div>
      <p className="text-sm t-text" style={{ marginTop: "0.5rem" }}>{p.why}</p>
      <Flex wrap gap={8} style={{ marginTop: "0.75rem" }}>
        {p.phone && (
          <a href={`tel:${p.phone.replace(/[^0-9]/g, "")}`} className="no-underline">
            <Button className="text-sm"><Phone size={16} /> Call {p.phone}</Button>
          </a>
        )}
        <a href={p.url} target="_blank" rel="noreferrer" className="no-underline">
          <Button variant="outline" className="text-sm"><ExternalLink size={16} /> Visit</Button>
        </a>
        <Button variant="ghost" className="text-sm" onClick={() => setFeedback("saved")}>
          <Bookmark size={16} /> {feedback === "saved" ? "Saved" : "Save"}
        </Button>
        <Button variant="ghost" className="text-sm t-muted" onClick={() => setFeedback("not_helpful")}>
          <ThumbsDown size={16} /> {feedback === "not_helpful" ? "Noted" : "Not helpful"}
        </Button>
      </Flex>
    </Card>
  );
}

export function HeadsUp() {
  const { data, loading, error, refetch } = useAsync(() => api.headsup("p_demo"));

  if (loading) return <Flex vertical gap={16}><Skeleton height="7rem" /><Skeleton height="10rem" /><Skeleton height="10rem" /></Flex>;
  if (error || !data) return <ErrorState message={error ?? "No data"} onRetry={refetch} />;

  if (data.status === "steady" || data.programs.length === 0)
    return (
      <Section>
        <Card className="p-6 text-center">
          <div className="text-lg font-semibold t-text">Nothing needed right now</div>
          <p className="text-sm t-muted" style={{ marginTop: "0.5rem" }}>You're steady. We'll surface support here if things start to build.</p>
        </Card>
      </Section>
    );

  return (
    <Section>
      <Flex vertical gap={20}>
        <h1 className="text-2xl font-bold t-text" style={{ letterSpacing: "-0.01em", margin: 0 }}>A little support</h1>

        <Card className="p-4">
          <p className="t-text" style={{ lineHeight: 1.6, margin: 0 }}>{data.note}</p>
          <div style={{ marginTop: "0.75rem" }}><Disclaimer>{data.note_disclaimer}</Disclaimer></div>
        </Card>

        <Flex vertical gap={12}>
          {data.programs.map((p) => <ProgramCard key={p.program_id} p={p} />)}
        </Flex>

        <Card className="p-4" style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <LifeBuoy className="t-headsup" size={20} style={{ marginTop: 2, flexShrink: 0 }} />
          <p className="text-sm t-text" style={{ margin: 0 }}>{data.crisis_note}</p>
        </Card>
      </Flex>
    </Section>
  );
}
