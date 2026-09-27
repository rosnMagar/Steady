import { Outlet, NavLink, Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Home, HeartPulse, ShieldCheck, Sun, Moon, ClipboardCheck } from "lucide-react";
import { Button } from "antd";
import { useTheme } from "../lib/theme";
import { PageTransition, NAV_SPRING } from "../components/PageTransition";

const nav = [
  { to: "/app", icon: Home, label: "Today", end: true },
  { to: "/app/checkin", icon: ClipboardCheck, label: "Check-in", end: false },
  { to: "/app/headsup", icon: HeartPulse, label: "Support", end: false },
  { to: "/app/privacy", icon: ShieldCheck, label: "Privacy", end: false },
];

export function CaregiverLayout() {
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const reduce = useReducedMotion();
  return (
    <div className="min-h-screen" style={{ background: "rgb(var(--bg))", display: "flex", justifyContent: "center" }}>
      <div className="min-h-screen" style={{ width: "100%", maxWidth: "28rem", display: "flex", flexDirection: "column" }}>
        <header
          style={{
            position: "sticky", top: 0, zIndex: 10, height: "3.5rem",
            display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 1.25rem",
            background: "rgb(var(--bg) / 0.9)",
            // Safari only supports the unprefixed property from 18.0; without the -webkit- form the
            // blur silently does nothing on every earlier iOS.
            backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
            borderBottom: "1px solid rgb(var(--border))",
          }}
        >
          <Link to="/" className="text-lg font-semibold t-text no-underline" style={{ letterSpacing: "-0.01em" }}>Steady</Link>
          <Button type="text" shape="circle" aria-label="Toggle theme" onClick={toggle}
            icon={theme === "light" ? <Moon size={18} /> : <Sun size={18} />} />
        </header>

        {/* Bottom padding clears the fixed tab bar plus the home indicator. */}
        <main style={{ flex: 1, padding: "1.25rem 1.25rem calc(6rem + env(safe-area-inset-bottom, 0px))" }}>
          <AnimatePresence mode="wait">
            <PageTransition key={location.pathname}>
              <Outlet />
            </PageTransition>
          </AnimatePresence>
        </main>

        <nav
          className="safe-bottom"
          style={{
            position: "fixed", bottom: 0, width: "100%", maxWidth: "28rem", display: "flex",
            borderTop: "1px solid rgb(var(--border))", background: "rgb(var(--surface) / 0.95)",
            backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          }}
        >
          {nav.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to} to={to} end={end}
              className="no-underline text-xs"
              style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "0.625rem 0", minHeight: 44 }}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="cg-nav-indicator"
                      transition={reduce ? { duration: 0 } : NAV_SPRING}
                      style={{ position: "absolute", top: 0, width: 28, height: 3, borderRadius: 9999, background: "rgb(var(--accent))" }}
                    />
                  )}
                  <Icon size={20} className={isActive ? "t-accent" : "t-muted"} />
                  <span className={isActive ? "t-accent" : "t-muted"}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
