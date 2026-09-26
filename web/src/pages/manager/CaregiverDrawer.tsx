import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Sparkles, ExternalLink } from "lucide-react";
import { api } from "../../api/client";
import { useAsync } from "../../hooks/useAsync";
import { Card, StatusChip, Skeleton, ErrorState, Button, Disclaimer } from "../../components/ui";
import { ForecastChart } from "../../components/ForecastChart";
import { MetricsPanel } from "../../components/MetricsPanel";
import { fmtDate } from "../../lib/status";

export function CaregiverDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, loading, error, refetch } = useAsync(() => api.cohortDetail(id), [id]);
  const metrics = useAsync(() => api.metrics(id), [id]);
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
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-20 bg-black/30"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.aside
          className="absolute right-0 top-0 h-full w-full max-w-lg bg-surface shadow-xl overflow-y-auto"
          initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
          transition={{ type: "tween", duration: 0.28 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 bg-surface/95 backdrop-blur border-b border-border px-5 h-14 flex items-center justify-between">
            <span className="font-semibold text-text">Caregiver detail</span>
            <button onClick={onClose} aria-label="Close" className="p-2 text-muted hover:text-text"><X size={18} /></button>
          </div>

          <div className="p-5 space-y-5">
            {loading ? (
              <><Skeleton className="h-20" /><Skeleton className="h-52" /><Skeleton className="h-28" /></>
            ) : error || !data ? (
              <ErrorState message={error ?? "No data"} onRetry={refetch} />
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xl font-bold text-text">{data.name}</div>
                    <div className="text-sm text-muted">{data.region}</div>
                  </div>
                  <StatusChip status={data.status} />
                </div>

                <Card className="p-4">
                  <div className="text-sm font-medium text-text mb-2">Forecast</div>
                  <ForecastChart series={data.series} baseline={data.baseline} height={200} />
                </Card>

                {metrics.data && metrics.data.metrics.length > 0 && (
                  <MetricsPanel metrics={metrics.data.metrics} asOf={metrics.data.as_of} dense possessive="their" />
                )}

                <Card className="p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-text">
                    <Sparkles size={16} className="text-accent" /> Care-manager brief
                  </div>
                  <p className="mt-2 text-sm text-text leading-relaxed">{data.manager_brief}</p>
                  <div className="mt-2"><Disclaimer>{data.brief_disclaimer}</Disclaimer></div>
                </Card>

                <div>
                  <div className="text-sm font-medium text-text mb-2">Suggested programs</div>
                  <div className="space-y-2">
                    {data.programs.map((p) => (
                      <Card key={p.program_id} className="p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-text text-sm">{p.name}</span>
                          <a href={p.url} target="_blank" rel="noreferrer" className="text-accent"><ExternalLink size={15} /></a>
                        </div>
                        <p className="text-xs text-muted mt-0.5">{p.why}</p>
                      </Card>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleContacted} disabled={contacting || contacted}>
                    {contacted ? <><Check size={16} /> Marked contacted</>
                      : contacting ? "Marking…" : "Mark contacted"}
                  </Button>
                  <Button variant="outline" onClick={handleDraft} disabled={draftLoading}>
                    <Sparkles size={16} /> {draftLoading ? "Drafting…" : "Draft outreach"}
                  </Button>
                </div>

                {actionError && <p className="text-xs text-headsup">{actionError}</p>}

                {draft && (
                  <Card className="p-4">
                    <Disclaimer>AI-drafted — review before sending.</Disclaimer>
                    <p className="mt-2 text-sm text-text whitespace-pre-line">{draft}</p>
                  </Card>
                )}

                {(contacted || data.contact_history.length > 0) && (
                  <div className="text-xs text-muted">
                    <div className="font-medium text-text mb-1">Contact history</div>
                    {contacted && <div>{fmtDate(new Date().toISOString().slice(0, 10))} — Outreach logged.</div>}
                    {data.contact_history.map((h, i) => (
                      <div key={i}>{fmtDate(h.date)} — {h.note}</div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </motion.aside>
      </motion.div>
    </AnimatePresence>
  );
}
