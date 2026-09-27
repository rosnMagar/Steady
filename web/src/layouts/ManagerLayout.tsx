import { Outlet, NavLink, Link } from "react-router-dom";
import { Sun, Moon } from "lucide-react";
import { Button } from "antd";
import { useTheme } from "../lib/theme";

const nav = [
  { to: "/dashboard", label: "Cohort", end: true },
  { to: "/dashboard/load", label: "Weekly load", end: false },
  { to: "/methods", label: "Methods", end: false },
];

export function ManagerLayout() {
  const { theme, toggle } = useTheme();
  return (
    <div style={{ minHeight: "100vh", background: "rgb(var(--bg))" }}>
      <header
        style={{
          position: "sticky", top: 0, zIndex: 10,
          background: "rgb(var(--bg) / 0.9)", backdropFilter: "blur(8px)", borderBottom: "1px solid rgb(var(--border))",
        }}
      >
        <div style={{ maxWidth: "72rem", margin: "0 auto", height: "4rem", padding: "0 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
            <Link to="/" className="text-lg font-semibold t-text no-underline" style={{ letterSpacing: "-0.01em" }}>Steady</Link>
            <span className="text-sm t-muted" style={{ display: "none" }}>Care manager</span>
            <nav style={{ display: "flex", gap: 4 }}>
              {nav.map(({ to, label, end }) => (
                <NavLink
                  key={to} to={to} end={end}
                  className={({ isActive }) => `text-sm font-medium no-underline ${isActive ? "t-accent" : "t-muted"}`}
                  style={({ isActive }) => ({
                    padding: "0.5rem 0.75rem", borderRadius: 8,
                    background: isActive ? "rgb(var(--accent-soft))" : undefined,
                  })}
                >
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
          <Button type="text" shape="circle" aria-label="Toggle theme" onClick={toggle}
            icon={theme === "light" ? <Moon size={18} /> : <Sun size={18} />} />
        </div>
      </header>
      <main style={{ maxWidth: "72rem", margin: "0 auto", padding: "1.5rem" }}>
        <Outlet />
      </main>
    </div>
  );
}
