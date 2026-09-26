import { Outlet, NavLink, Link } from "react-router-dom";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../lib/theme";

const nav = [
  { to: "/dashboard", label: "Cohort", end: true },
  { to: "/dashboard/load", label: "Weekly load", end: false },
  { to: "/methods", label: "Methods", end: false },
];

export function ManagerLayout() {
  const { theme, toggle } = useTheme();
  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-10 bg-bg/90 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-8">
            <Link to="/" className="font-semibold text-lg tracking-tight text-text">Steady</Link>
            <span className="text-sm text-muted hidden sm:inline">Care manager</span>
            <nav className="flex gap-1">
              {nav.map(({ to, label, end }) => (
                <NavLink
                  key={to} to={to} end={end}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-lg text-sm font-medium ${
                      isActive ? "text-accent bg-accent-soft" : "text-muted hover:text-text"
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
          <button onClick={toggle} aria-label="Toggle theme" className="p-2 rounded-lg text-muted hover:text-text">
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
