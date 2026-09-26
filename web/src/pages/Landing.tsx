import { Link } from "react-router-dom";
import { Smartphone, LayoutDashboard, ArrowRight } from "lucide-react";
import { Card, Section } from "../components/ui";

export function Landing() {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6">
      <Section className="max-w-lg w-full text-center">
        <h1 className="text-4xl font-bold tracking-tight text-text">Steady</h1>
        <p className="mt-3 text-muted text-lg">
          Family caregivers are invisible to the health system. Steady reads a caregiver's own
          wearable signals, sees strain building days ahead, and connects them to real support.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 text-left">
          <Link to="/app">
            <Card className="p-5 hover:shadow-lg transition h-full">
              <Smartphone className="text-accent" size={22} />
              <div className="mt-3 font-semibold text-text flex items-center gap-1">
                Caregiver app <ArrowRight size={16} />
              </div>
              <div className="mt-1 text-sm text-muted">The mobile experience a caregiver sees each day.</div>
            </Card>
          </Link>
          <Link to="/dashboard">
            <Card className="p-5 hover:shadow-lg transition h-full">
              <LayoutDashboard className="text-accent" size={22} />
              <div className="mt-3 font-semibold text-text flex items-center gap-1">
                Care-manager dashboard <ArrowRight size={16} />
              </div>
              <div className="mt-1 text-sm text-muted">The cohort view for a health plan or agency.</div>
            </Card>
          </Link>
        </div>

        <Link to="/methods" className="inline-block mt-6 text-sm text-accent hover:underline">
          How it works & honest limits →
        </Link>
      </Section>
    </div>
  );
}
