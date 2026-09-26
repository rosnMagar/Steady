import { ReactNode } from "react";
import { motion } from "framer-motion";
import type { Status } from "../api/types";
import { STATUS } from "../lib/status";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-surface border border-border shadow-card ${className}`}>
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
  children, onClick, variant = "primary", className = "", ...rest
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "outline";
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = {
    primary: "bg-accent text-white hover:opacity-90",
    ghost: "text-accent hover:bg-accent-soft",
    outline: "border border-border text-text hover:bg-bg",
  }[variant];
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl font-medium transition ${styles} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function StatusChip({ status, size = "md" }: { status: Status; size?: "sm" | "md" }) {
  const m = STATUS[status];
  const pad = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${pad} text-${m.colorVar}`}
      style={{ backgroundColor: `rgb(var(--${m.colorVar}) / 0.12)` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: `rgb(var(--${m.colorVar}))` }} />
      {m.label}
    </span>
  );
}

export function StatTile({ label, value, tone }: { label: string; value: ReactNode; tone?: Status }) {
  const color = tone ? `text-${STATUS[tone].colorVar}` : "text-text";
  return (
    <Card className="p-4">
      <div className="text-sm text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>{value}</div>
    </Card>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse-soft rounded-xl bg-border/60 ${className}`} />;
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <Card className="p-8 text-center">
      <div className="font-medium text-text">{title}</div>
      {hint && <div className="mt-1 text-sm text-muted">{hint}</div>}
    </Card>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="p-6 text-center">
      <div className="font-medium text-headsup">Something went wrong</div>
      <div className="mt-1 text-sm text-muted">{message}</div>
      {onRetry && (
        <Button variant="outline" className="mt-4" onClick={onRetry}>Try again</Button>
      )}
    </Card>
  );
}

export function Disclaimer({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs text-muted flex items-center gap-1.5">
      <span aria-hidden>✎</span> {children}
    </p>
  );
}
