import { useState } from "react";
import { Phone, ExternalLink, Bookmark, ThumbsDown, LifeBuoy } from "lucide-react";
import { api } from "../../api/client";
import { useAsync } from "../../hooks/useAsync";
import { Card, Section, Skeleton, ErrorState, Button, Disclaimer } from "../../components/ui";
import type { Program } from "../../api/types";

function ProgramCard({ p }: { p: Program }) {
  const [feedback, setFeedback] = useState<"saved" | "not_helpful" | null>(null);
  return (
    <Card className="p-4">
      <div className="font-semibold text-text">{p.name}</div>
      <div className="text-xs text-muted">{p.org}</div>
      <p className="mt-2 text-sm text-text">{p.why}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {p.phone && (
          <a href={`tel:${p.phone.replace(/[^0-9]/g, "")}`}>
            <Button className="text-sm"><Phone size={16} /> Call {p.phone}</Button>
          </a>
        )}
        <a href={p.url} target="_blank" rel="noreferrer">
          <Button variant="outline" className="text-sm"><ExternalLink size={16} /> Visit</Button>
        </a>
        <Button variant="ghost" className="text-sm" onClick={() => setFeedback("saved")}>
          <Bookmark size={16} /> {feedback === "saved" ? "Saved" : "Save"}
        </Button>
        <Button variant="ghost" className="text-sm text-muted" onClick={() => setFeedback("not_helpful")}>
          <ThumbsDown size={16} /> {feedback === "not_helpful" ? "Noted" : "Not helpful"}
        </Button>
      </div>
    </Card>
  );
}

export function HeadsUp() {
  const { data, loading, error, refetch } = useAsync(() => api.headsup("p_demo"));

  if (loading) return <div className="space-y-4"><Skeleton className="h-28" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>;
  if (error || !data) return <ErrorState message={error ?? "No data"} onRetry={refetch} />;

  if (data.status === "steady" || data.programs.length === 0)
    return (
      <Section>
        <Card className="p-6 text-center">
          <div className="text-lg font-semibold text-text">Nothing needed right now</div>
          <p className="mt-2 text-sm text-muted">You're steady. We'll surface support here if things start to build.</p>
        </Card>
      </Section>
    );

  return (
    <Section className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text">A little support</h1>
      </div>

      <Card className="p-4">
        <p className="text-text leading-relaxed">{data.note}</p>
        <div className="mt-3"><Disclaimer>{data.note_disclaimer}</Disclaimer></div>
      </Card>

      <div className="space-y-3">
        {data.programs.map((p) => <ProgramCard key={p.program_id} p={p} />)}
      </div>

      <Card className="p-4 flex items-start gap-3" >
        <LifeBuoy className="text-headsup mt-0.5" size={20} />
        <p className="text-sm text-text">{data.crisis_note}</p>
      </Card>
    </Section>
  );
}
