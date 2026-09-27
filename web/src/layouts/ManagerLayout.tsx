import { Outlet, NavLink, Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { Button } from "antd";
import { useTheme } from "../lib/theme";
import { PageTransition, NAV_SPRING } from "../components/PageTransition";

const nav = [
  { to: "/dashboard", label: "Cohort", end: true },
  { to: "/dashboard/load", label: "Weekly load", end: false },
  { to: "/methods", label: "Methods", end: false },
];

export function ManagerLayout() {
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const reduce = useReducedMotion();
  return (
    <div className="min-h-screen" style={{ background: "rgb(var(--bg))" }}>
      <header
        style={{
          position: "sticky", top: 0, zIndex: 10,
          background: "rgb(var(--bg) / 0.9)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", borderBottom: "1px solid rgb(var(--border))",
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
                  className="text-sm font-medium no-underline"
                  style={{ position: "relative", padding: "0.5rem 0.75rem", borderRadius: 8 }}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.span
                          layoutId="mgr-nav-indicator"
                          transition={reduce ? { duration: 0 } : NAV_SPRING}
                          style={{ position: "absolute", inset: 0, borderRadius: 8, background: "rgb(var(--accent-soft))", zIndex: 0 }}
                        />
                      )}
                      <span className={isActive ? "t-accent" : "t-muted"} style={{ position: "relative", zIndex: 1 }}>{label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
          <Button type="text" shape="circle" aria-label="Toggle theme" onClick={toggle}
            icon={theme === "light" ? <Moon size={18} /> : <Sun size={18} />} />
        </div>
      </header>
      <main style={{ maxWidth: "72rem", margin: "0 auto", padding: "1.5rem" }}>
        <AnimatePresence mode="wait">
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </AnimatePresence>
      </main>
    </div>
  );
}
