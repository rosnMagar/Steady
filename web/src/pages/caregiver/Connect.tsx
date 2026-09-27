import { useState } from "react";
import { Watch, Check } from "lucide-react";
import { Flex } from "antd";
import { Section, Card, Button } from "../../components/ui";

export function Connect() {
  const [synced, setSynced] = useState(false);
  return (
    <Section>
      <Flex vertical gap={20}>
        <h1 className="text-2xl font-bold t-text" style={{ letterSpacing: "-0.01em", margin: 0 }}>Connect your watch</h1>
        <p className="t-muted" style={{ margin: 0 }}>
          Steady reads a few daily numbers from Apple Health through a Shortcut — no extra app to install.
        </p>

        <Card className="p-4">
          <Flex vertical gap={12} className="text-sm t-text">
            <div style={{ display: "flex", gap: 12 }}><span className="font-semibold t-accent">1</span> Add the Steady Shortcut from the link we texted you.</div>
            <div style={{ display: "flex", gap: 12 }}><span className="font-semibold t-accent">2</span> Tap “Allow” when it asks to read Health data.</div>
            <div style={{ display: "flex", gap: 12 }}><span className="font-semibold t-accent">3</span> It sends one small update each evening.</div>
          </Flex>
        </Card>

        <Card className="p-5" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ position: "relative", display: "inline-flex", height: 12, width: 12 }}>
              {!synced && <span className="pulse-soft" style={{ position: "absolute", inset: 0, borderRadius: 9999, background: "rgb(var(--accent))", opacity: 0.6 }} />}
              <span style={{ position: "relative", height: 12, width: 12, borderRadius: 9999, background: synced ? "rgb(var(--steady))" : "rgb(var(--accent))" }} />
            </span>
            <div>
              <div className="text-sm font-medium t-text">{synced ? "Last synced just now" : "Waiting for first sync…"}</div>
              <div className="text-xs t-muted">Apple Watch · steps, resting HR, sleep</div>
            </div>
          </div>
          <Watch className="t-muted" size={22} />
        </Card>

        <Button variant="outline" className="w-full" onClick={() => setSynced(true)}>
          {synced ? <><Check size={16} /> Synced</> : "Simulate a sync (demo)"}
        </Button>
      </Flex>
    </Section>
  );
}
