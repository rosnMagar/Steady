import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Flex } from "antd";
import { Card, Skeleton, Disclaimer } from "./ui";
import { EASE } from "./PageTransition";
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
  const reduce = useReducedMotion();
  const fade = { duration: 0.24, ease: EASE };
  return (
    <Card
      className="p-4"
      style={{
        background: "rgb(var(--accent) / 0.06)",
        borderLeft: "3px solid rgb(var(--accent-ink))",
      }}
    >
      <Flex align="center" gap={8} wrap style={{ marginBottom: 8 }}>
        {/* A slow, subtle pulse signals "this is generated" without ever being distracting. */}
        <motion.span
          animate={reduce ? undefined : { opacity: [1, 0.55, 1] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
          style={{ display: "inline-flex" }}
        >
          <Sparkles className="t-accent" size={18} aria-hidden />
        </motion.span>
        <div className="font-semibold t-text">AI suggestion</div>
        {subtitle && <span className="text-xs t-muted">· {subtitle}</span>}
      </Flex>
      {/* mode="wait" so the skeleton finishes leaving before the text arrives — no overlap jump. */}
      <AnimatePresence mode="wait" initial={false}>
        {loading ? (
          <motion.div key="loading" exit={reduce ? undefined : { opacity: 0 }} transition={fade}>
            <Flex vertical gap={8}>
              <Skeleton height="0.9rem" /><Skeleton height="0.9rem" /><Skeleton height="0.9rem" width="70%" />
            </Flex>
          </motion.div>
        ) : error || !data ? (
          <motion.div key="error" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={fade}>
            <div className="text-sm t-muted">Insight unavailable right now.</div>
          </motion.div>
        ) : (
          <motion.div
            key="text"
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={fade}
          >
            <p className="t-text" style={{ lineHeight: 1.65, margin: 0 }}>{data.insight}</p>
            <div style={{ marginTop: 10 }}>
              <Disclaimer>{data.disclaimer}{data.model ? ` · ${data.model}` : ""}</Disclaimer>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
