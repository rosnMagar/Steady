import { useState } from "react";
import { Watch, Check } from "lucide-react";
import { Section, Card, Button } from "../../components/ui";

export function Connect() {
  const [synced, setSynced] = useState(false);
  return (
    <Section className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight text-text">Connect your watch</h1>
      <p className="text-muted">
        Steady reads a few daily numbers from Apple Health through a Shortcut — no extra app to install.
      </p>

      <Card className="p-4 space-y-3 text-sm text-text">
        <div className="flex gap-3"><span className="font-semibold text-accent">1</span> Add the Steady Shortcut from the link we texted you.</div>
        <div className="flex gap-3"><span className="font-semibold text-accent">2</span> Tap “Allow” when it asks to read Health data.</div>
        <div className="flex gap-3"><span className="font-semibold text-accent">3</span> It sends one small update each evening.</div>
      </Card>

      <Card className="p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            {!synced && <span className="animate-pulse-soft absolute inline-flex h-full w-full rounded-full bg-accent opacity-60" />}
            <span className={`relative inline-flex h-3 w-3 rounded-full ${synced ? "bg-steady" : "bg-accent"}`} />
          </span>
          <div>
            <div className="text-sm font-medium text-text">{synced ? "Last synced just now" : "Waiting for first sync…"}</div>
            <div className="text-xs text-muted">Apple Watch · steps, resting HR, sleep</div>
          </div>
        </div>
        <Watch className="text-muted" size={22} />
      </Card>

      <Button variant="outline" className="w-full" onClick={() => setSynced(true)}>
        {synced ? <><Check size={16} /> Synced</> : "Simulate a sync (demo)"}
      </Button>
    </Section>
  );
}
