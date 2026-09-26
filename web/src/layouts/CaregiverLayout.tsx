import { Outlet, NavLink, Link } from "react-router-dom";
import { Home, HeartPulse, ShieldCheck, Sun, Moon, ClipboardCheck } from "lucide-react";
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
    <div className="min-h-screen bg-bg flex justify-center">
      <div className="w-full max-w-md flex flex-col min-h-screen bg-bg">
        <header className="sticky top-0 z-10 flex items-center justify-between px-5 h-14 bg-bg/90 backdrop-blur border-b border-border">
          <Link to="/" className="font-semibold text-lg tracking-tight text-text">Steady</Link>
          <button onClick={toggle} aria-label="Toggle theme" className="p-2 rounded-lg text-muted hover:text-text">
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </header>

        <main className="flex-1 px-5 py-5 pb-24">
          <Outlet />
        </main>

        <nav className="fixed bottom-0 w-full max-w-md border-t border-border bg-surface/95 backdrop-blur">
          <div className="grid grid-cols-4">
            {nav.map(({ to, icon: Icon, label, end }) => (
              <NavLink
                key={to} to={to} end={end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2.5 text-xs min-h-[44px] ${
                    isActive ? "text-accent" : "text-muted"
                  }`
                }
              >
                <Icon size={20} />
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
