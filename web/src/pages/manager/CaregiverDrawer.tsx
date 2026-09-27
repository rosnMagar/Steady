import { useState } from "react";
import { Check, Sparkles, ExternalLink } from "lucide-react";
import { Drawer, Flex } from "antd";
import { api } from "../../api/client";
import { useAsync } from "../../hooks/useAsync";
import { Card, StatusChip, Skeleton, ErrorState, Button, Disclaimer } from "../../components/ui";
import { ForecastChart } from "../../components/ForecastChart";
import { MetricsPanel } from "../../components/MetricsPanel";
import { fmtDate } from "../../lib/status";

export function CaregiverDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, loading, error, refetch } = useAsync(() => api.cohortDetail(id), [id]);
  const metrics = useAsync(() => api.metrics(id), [id]);
  const [open, setOpen] = useState(true);
  const [contacted, setContacted] = useState(false);
  const [contacting, setContacting] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleContacted = async () => {
    setContacting(true);
    setActionError(null);
    try {
      await api.markContacted(id);
      setContacted(true);
    } catch (e) {
      setActionError("Couldn't mark contacted — try again.");
    } finally {
      setContacting(false);
    }
  };

  const handleDraft = async () => {
    setDraftLoading(true);
    setActionError(null);
    try {
      const { draft } = await api.outreachDraft(id);
      setDraft(draft);
    } catch (e) {
      setActionError("Couldn't draft outreach — try again.");
    } finally {
      setDraftLoading(false);
    }
  };

  return (
    <Drawer
      open={open}
      placement="right"
      onClose={() => setOpen(false)}
      afterOpenChange={(o) => { if (!o) onClose(); }}
      title={<span className="font-semibold t-text">Caregiver detail</span>}
      width="min(100vw, 32rem)"
      styles={{ body: { background: "rgb(var(--surface))" }, header: { background: "rgb(var(--surface))" } }}
    >
      <Flex vertical gap={20}>
        {loading ? (
          <><Skeleton height="5rem" /><Skeleton height="13rem" /><Skeleton height="7rem" /></>
        ) : error || !data ? (
          <ErrorState message={error ?? "No data"} onRetry={refetch} />
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div className="text-xl font-bold t-text">{data.name}</div>
                <div className="text-sm t-muted">{data.region}</div>
              </div>
              <StatusChip status={data.status} />
            </div>

            <Card className="p-4">
              <div className="text-sm font-medium t-text" style={{ marginBottom: "0.5rem" }}>Forecast</div>
              <ForecastChart series={data.series} baseline={data.baseline} height={200} />
            </Card>

            {metrics.data && metrics.data.metrics.length > 0 && (
              <MetricsPanel metrics={metrics.data.metrics} asOf={metrics.data.as_of} dense possessive="their" />
            )}

            <Card className="p-4">
              <div className="text-sm font-medium t-text" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Sparkles size={16} className="t-accent" /> Care-manager brief
              </div>
              <p className="text-sm t-text" style={{ marginTop: "0.5rem", lineHeight: 1.6, marginBottom: 0 }}>{data.manager_brief}</p>
              <div style={{ marginTop: "0.5rem" }}><Disclaimer>{data.brief_disclaimer}</Disclaimer></div>
            </Card>

            <div>
              <div className="text-sm font-medium t-text" style={{ marginBottom: "0.5rem" }}>Suggested programs</div>
              <Flex vertical gap={8}>
                {data.programs.map((p) => (
                  <Card key={p.program_id} className="p-3">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span className="font-medium t-text text-sm">{p.name}</span>
                      <a href={p.url} target="_blank" rel="noreferrer" className="t-accent"><ExternalLink size={15} /></a>
                    </div>
                    <p className="text-xs t-muted" style={{ marginTop: 2, marginBottom: 0 }}>{p.why}</p>
                  </Card>
                ))}
              </Flex>
            </div>

            <Flex wrap gap={8}>
              <Button onClick={handleContacted} disabled={contacting || contacted}>
                {contacted ? <><Check size={16} /> Marked contacted</>
                  : contacting ? "Marking…" : "Mark contacted"}
              </Button>
              <Button variant="outline" onClick={handleDraft} disabled={draftLoading}>
                <Sparkles size={16} /> {draftLoading ? "Drafting…" : "Draft outreach"}
              </Button>
            </Flex>

            {actionError && <p className="text-xs t-headsup" style={{ margin: 0 }}>{actionError}</p>}

            {draft && (
              <Card className="p-4">
                <Disclaimer>AI-drafted — review before sending.</Disclaimer>
                <p className="text-sm t-text" style={{ marginTop: "0.5rem", whiteSpace: "pre-line" }}>{draft}</p>
              </Card>
            )}

            {(contacted || data.contact_history.length > 0) && (
              <div className="text-xs t-muted">
                <div className="font-medium t-text" style={{ marginBottom: 4 }}>Contact history</div>
                {contacted && <div>{fmtDate(new Date().toISOString().slice(0, 10))} — Outreach logged.</div>}
                {data.contact_history.map((h, i) => (
                  <div key={i}>{fmtDate(h.date)} — {h.note}</div>
                ))}
              </div>
            )}
          </>
        )}
      </Flex>
    </Drawer>
  );
}
