import { Outlet, NavLink, Link } from "react-router-dom";
import { Home, HeartPulse, ShieldCheck, Sun, Moon, ClipboardCheck } from "lucide-react";
import { Button } from "antd";
import { useTheme } from "../lib/theme";

const nav = [
  { to: "/app", icon: Home, label: "Today", end: true },
  { to: "/app/checkin", icon: ClipboardCheck, label: "Check-in", end: false },
  { to: "/app/headsup", icon: HeartPulse, label: "Support", end: false },
  { to: "/app/privacy", icon: ShieldCheck, label: "Privacy", end: false },
];

export function CaregiverLayout() {
  const { theme, toggle } = useTheme();
  return (
    <div style={{ minHeight: "100vh", background: "rgb(var(--bg))", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: "28rem", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <header
          style={{
            position: "sticky", top: 0, zIndex: 10, height: "3.5rem",
            display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 1.25rem",
            background: "rgb(var(--bg) / 0.9)", backdropFilter: "blur(8px)", borderBottom: "1px solid rgb(var(--border))",
          }}
        >
          <Link to="/" className="text-lg font-semibold t-text no-underline" style={{ letterSpacing: "-0.01em" }}>Steady</Link>
          <Button type="text" shape="circle" aria-label="Toggle theme" onClick={toggle}
            icon={theme === "light" ? <Moon size={18} /> : <Sun size={18} />} />
        </header>

        <main style={{ flex: 1, padding: "1.25rem 1.25rem 6rem" }}>
          <Outlet />
        </main>

        <nav
          style={{
            position: "fixed", bottom: 0, width: "100%", maxWidth: "28rem", display: "flex",
            borderTop: "1px solid rgb(var(--border))", background: "rgb(var(--surface) / 0.95)", backdropFilter: "blur(8px)",
          }}
        >
          {nav.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to} to={to} end={end}
              className={({ isActive }) => `no-underline text-xs ${isActive ? "t-accent" : "t-muted"}`}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "0.625rem 0", minHeight: 44 }}
            >
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
