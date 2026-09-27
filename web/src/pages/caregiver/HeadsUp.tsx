import { useMemo, useState } from "react";
import {
  Phone, ExternalLink, Bookmark, ThumbsDown, LifeBuoy, Share2, Heart, Search, Info,
} from "lucide-react";
import { Flex, Input, Segmented } from "antd";
import { api } from "../../api/client";
import { useAsync } from "../../hooks/useAsync";
import { Card, Section, Skeleton, ErrorState, Button, Disclaimer } from "../../components/ui";
import type { Program, CatalogProgram, SelfCareTip } from "../../api/types";

const PERSON_ID = "p_demo";

async function shareProgram(p: { name: string; org: string; url: string; phone?: string }) {
  const text = `${p.name} — ${p.org}${p.phone ? ` · ${p.phone}` : ""}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: p.name, text, url: p.url });
      return;
    }
    await navigator.clipboard.writeText(`${text}\n${p.url}`);
  } catch { /* user cancelled or blocked — no-op */ }
}

function ProgramActions({ p, share }: { p: { phone?: string; url: string }; share: () => void }) {
  return (
    <>
      {p.phone && (
        <a href={`tel:${p.phone.replace(/[^0-9]/g, "")}`} className="no-underline">
          <Button className="text-sm"><Phone size={16} /> Call {p.phone}</Button>
        </a>
      )}
      <a href={p.url} target="_blank" rel="noreferrer" className="no-underline">
        <Button variant="outline" className="text-sm"><ExternalLink size={16} /> Visit</Button>
      </a>
      <Button variant="ghost" className="text-sm" onClick={share}>
        <Share2 size={16} /> Share
      </Button>
    </>
  );
}

/** Rich card for a program recommended to this caregiver — with feedback wired to the API. */
function RecommendedCard({ p }: { p: Program }) {
  const [feedback, setFeedback] = useState<"saved" | "not_helpful" | null>(null);
  const send = (next: "saved" | "not_helpful") => {
    setFeedback(next);
    void api.feedback(PERSON_ID, p.program_id, next === "saved").catch(() => {});
  };
  return (
    <Card className="p-4">
      <div className="font-semibold t-text">{p.name}</div>
      <div className="text-xs t-muted">{p.org}</div>
      <p className="text-sm t-text" style={{ marginTop: "0.5rem" }}>{p.why}</p>
      {p.description && (
        <div className="text-sm t-muted" style={{ marginTop: "0.5rem", display: "flex", gap: 6 }}>
          <Info size={14} style={{ marginTop: 3, flexShrink: 0 }} />
          <span>{p.description}</span>
        </div>
      )}
      {p.eligibility && <div className="text-xs t-muted" style={{ marginTop: "0.5rem" }}><b>Who it's for:</b> {p.eligibility}</div>}
      <Flex wrap gap={8} style={{ marginTop: "0.75rem" }}>
        <ProgramActions p={p} share={() => shareProgram(p)} />
        <Button variant="ghost" className="text-sm" onClick={() => send("saved")}>
          <Bookmark size={16} /> {feedback === "saved" ? "Saved" : "Save"}
        </Button>
        <Button variant="ghost" className="text-sm t-muted" onClick={() => send("not_helpful")}>
          <ThumbsDown size={16} /> {feedback === "not_helpful" ? "Noted" : "Not helpful"}
        </Button>
      </Flex>
    </Card>
  );
}

function SelfCareSection({ tips, disclaimer }: { tips: SelfCareTip[]; disclaimer: string }) {
  if (!tips.length) return null;
  return (
    <Card className="p-4">
      <Flex align="center" gap={8} style={{ marginBottom: 4 }}>
        <Heart className="t-steady" size={18} />
        <div className="font-semibold t-text">Ways to take care of you</div>
      </Flex>
      <Flex vertical gap={12} style={{ marginTop: 8 }}>
        {tips.map((t) => (
          <div key={t.title}>
            <div className="text-sm font-medium t-text">{t.title}</div>
            <div className="text-sm t-muted">{t.body}</div>
          </div>
        ))}
      </Flex>
      <div style={{ marginTop: 10 }}><Disclaimer>{disclaimer}</Disclaimer></div>
    </Card>
  );
}

function CatalogCard({ p }: { p: CatalogProgram }) {
  return (
    <Card className="p-4">
      <div className="font-semibold t-text">{p.name}</div>
      <div className="text-xs t-muted">{p.org}</div>
      {p.description && <p className="text-sm t-text" style={{ marginTop: "0.5rem" }}>{p.description}</p>}
      {p.eligibility && <div className="text-xs t-muted" style={{ marginTop: "0.5rem" }}><b>Who it's for:</b> {p.eligibility}</div>}
      <Flex wrap gap={8} style={{ marginTop: "0.75rem" }}>
        <ProgramActions p={p} share={() => shareProgram(p)} />
      </Flex>
    </Card>
  );
}

/** Always-on resource library: browse every real program by category, any time. */
function ResourceLibrary() {
  const { data, loading, error, refetch } = useAsync(() => api.programs());
  const [cat, setCat] = useState<string>("All");
  const [q, setQ] = useState("");

  const categories = useMemo(() => {
    const set = new Set<string>();
    (data?.programs ?? []).filter((p) => !p.crisis).forEach((p) => set.add(p.category));
    return ["All", ...Array.from(set)];
  }, [data]);

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    return (data?.programs ?? [])
      .filter((p) => !p.crisis)
      .filter((p) => cat === "All" || p.category === cat)
      .filter((p) => !ql || p.name.toLowerCase().includes(ql) || p.org.toLowerCase().includes(ql) || p.description.toLowerCase().includes(ql));
  }, [data, cat, q]);

  return (
    <Flex vertical gap={12}>
      <div>
        <h2 className="text-lg font-semibold t-text" style={{ margin: 0 }}>Explore all support</h2>
        <p className="text-sm t-muted" style={{ margin: 0 }}>Verified programs you can reach any time — not just when things are heavy.</p>
      </div>
      {loading ? (
        <Skeleton height="12rem" />
      ) : error || !data ? (
        <ErrorState message={error ?? "Couldn't load resources"} onRetry={refetch} />
      ) : (
        <>
          <Flex vertical gap={8}>
            <div style={{ overflowX: "auto" }}>
              <Segmented value={cat} onChange={(v) => setCat(String(v))} options={categories} />
            </div>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search resources…"
              prefix={<Search size={15} className="t-muted" />}
              allowClear
            />
          </Flex>
          <Flex vertical gap={12}>
            {filtered.length === 0
              ? <Card className="p-6 text-center t-muted">No resources match.</Card>
              : filtered.map((p) => <CatalogCard key={p.program_id} p={p} />)}
          </Flex>
        </>
      )}
    </Flex>
  );
}

export function HeadsUp() {
  const { data, loading, error, refetch } = useAsync(() => api.headsup(PERSON_ID));

  if (loading) return <Flex vertical gap={16}><Skeleton height="7rem" /><Skeleton height="10rem" /><Skeleton height="10rem" /></Flex>;
  if (error || !data) return <ErrorState message={error ?? "No data"} onRetry={refetch} />;

  const steady = data.status === "steady" || data.programs.length === 0;

  return (
    <Section>
      <Flex vertical gap={20}>
        <h1 className="text-2xl font-bold t-text" style={{ letterSpacing: "-0.01em", margin: 0 }}>
          {steady ? "Support, whenever you need it" : "A little support"}
        </h1>

        {/* Status note */}
        <Card className="p-4">
          <p className="t-text" style={{ lineHeight: 1.6, margin: 0 }}>{data.note}</p>
          {!steady && <div style={{ marginTop: "0.75rem" }}><Disclaimer>{data.note_disclaimer}</Disclaimer></div>}
        </Card>

        {/* Self-care */}
        <SelfCareSection tips={data.self_care} disclaimer={data.self_care_disclaimer} />

        {/* Recommended programs (only when something is building/heads-up) */}
        {!steady && (
          <Flex vertical gap={12}>
            <h2 className="text-lg font-semibold t-text" style={{ margin: 0 }}>Recommended for you</h2>
            {data.programs.map((p) => <RecommendedCard key={p.program_id} p={p} />)}
          </Flex>
        )}

        {/* Always-on resource library */}
        <ResourceLibrary />

        {/* Crisis */}
        <Card className="p-4" style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <LifeBuoy className="t-headsup" size={20} style={{ marginTop: 2, flexShrink: 0 }} />
          <p className="text-sm t-text" style={{ margin: 0 }}>{data.crisis_note}</p>
        </Card>
      </Flex>
    </Section>
  );
}
