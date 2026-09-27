import { ReactNode, useEffect, useState } from "react";
import { motion, useReducedMotion, animate } from "framer-motion";
import { Button as AntButton, Tag, Statistic } from "antd";
import type { Status } from "../api/types";
import { STATUS } from "../lib/status";

export function Card({ children, className = "", interactive = false, onClick, style }: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`app-card ${interactive ? "interactive" : ""} ${className}`} onClick={onClick} style={style}>
      {children}
    </div>
  );
}

export function Section({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function Button({
  children, onClick, variant = "primary", className = "", disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "outline";
  className?: string;
  disabled?: boolean;
}) {
  const type = variant === "primary" ? "primary" : variant === "ghost" ? "text" : "default";
  return (
    <AntButton
      type={type}
      size="large"
      onClick={onClick}
      disabled={disabled}
      block={className.includes("w-full")}
      className={`min-tap ${className}`}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{children}</span>
    </AntButton>
  );
}

export function StatusChip({ status, size = "md" }: { status: Status; size?: "sm" | "md" }) {
  const m = STATUS[status];
  const fontSize = size === "sm" ? "0.75rem" : "0.875rem";
  const pad = size === "sm" ? "0.125rem 0.5rem" : "0.25rem 0.75rem";
  return (
    <Tag
      bordered={false}
      className="status-chip"
      style={{ fontSize, padding: pad, margin: 0, color: `rgb(var(--${m.colorVar}-ink))`, backgroundColor: `rgb(var(--${m.colorVar}) / 0.12)` }}
    >
      <span style={{ height: 6, width: 6, borderRadius: 9999, backgroundColor: `rgb(var(--${m.colorVar}))` }} />
      {m.label}
    </Tag>
  );
}

/** Counts a number up to its final value on mount. Purely decorative, so it snaps straight to the
 *  answer when the user prefers reduced motion — a KPI must never be slower to read than it is now. */
function CountUp({ to }: { to: number }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? to : 0);
  useEffect(() => {
    if (reduce) {
      setN(to);
      return;
    }
    const controls = animate(0, to, {
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setN(Math.round(v)),
    });
    return () => controls.stop();
  }, [to, reduce]);
  return <>{n}</>;
}

export function StatTile({ label, value, tone }: { label: string; value: ReactNode; tone?: Status }) {
  const color = tone ? `rgb(var(--${STATUS[tone].colorVar}-ink))` : "rgb(var(--text))";
  // antd's Statistic only renders string|number itself; anything richer has to go through
  // `formatter`, otherwise a ReactNode stringifies to "[object Object]".
  const isNode = typeof value !== "string" && typeof value !== "number";
  // Plain integers count up; anything else renders as-is through the formatter.
  const isCountable = typeof value === "number" && Number.isFinite(value);
  return (
    // height:100% so tiles in a Row align="stretch" line up even when a label wraps on mobile.
    <Card className="p-4" style={{ height: "100%" }}>
      <Statistic
        title={<span className="t-muted text-sm">{label}</span>}
        value={isNode ? "" : (value as string | number)}
        formatter={
          isCountable ? () => <CountUp to={value as number} />
            : isNode ? () => value
            : undefined
        }
        valueStyle={{ color, fontSize: "1.5rem", fontWeight: 600 }}
      />
    </Card>
  );
}

export function Skeleton({ height = "6rem", width = "100%", className = "" }: {
  height?: string;
  width?: string;
  className?: string;
}) {
  return <div className={`skeleton ${className}`} style={{ height, width }} />;
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <Card className="p-6 text-center">
      <div className="font-medium t-text">{title}</div>
      {hint && <div className="mt-1 text-sm t-muted">{hint}</div>}
    </Card>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="p-6 text-center">
      <div className="font-medium t-headsup">Something went wrong</div>
      <div className="mt-1 text-sm t-muted">{message}</div>
      {onRetry && (
        <div style={{ marginTop: "1rem" }}><Button variant="outline" onClick={onRetry}>Try again</Button></div>
      )}
    </Card>
  );
}

export function Disclaimer({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs t-muted" style={{ display: "inline-flex", alignItems: "center", gap: 6, margin: 0 }}>
      <span aria-hidden>✎</span> {children}
    </p>
  );
}
