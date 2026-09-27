import { Download, Trash2, PauseCircle } from "lucide-react";
import { Flex } from "antd";
import { Section, Card, Button, Disclaimer } from "../../components/ui";

export function Privacy() {
  return (
    <Section>
      <Flex vertical gap={20}>
        <h1 className="text-2xl font-bold t-text" style={{ letterSpacing: "-0.01em", margin: 0 }}>Your data, your call</h1>

        <Card className="p-4">
          <div className="text-sm font-medium t-text">What Steady stores</div>
          <p className="text-sm t-muted" style={{ marginTop: "0.25rem", marginBottom: 0 }}>
            One row per day: your step count, resting heart rate, sleep length, and any check-in you send.
            Stored under a random ID, never your name. No location, no raw heart-rate streams.
          </p>
        </Card>

        <Flex vertical gap={12}>
          <Card className="p-4" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}><Download size={20} className="t-accent" />
              <span className="text-sm t-text">Export everything Steady has</span></div>
            <Button variant="outline" className="text-sm">Export</Button>
          </Card>
          <Card className="p-4" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}><PauseCircle size={20} className="t-accent" />
              <span className="text-sm t-text">Pause syncing</span></div>
            <Button variant="outline" className="text-sm">Pause</Button>
          </Card>
          <Card className="p-4" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}><Trash2 size={20} className="t-headsup" />
              <span className="text-sm t-text">Delete all my data</span></div>
            <Button variant="outline" className="text-sm">Delete</Button>
          </Card>
        </Flex>

        <Disclaimer>Steady is caregiver support, not a diagnosis or a medical device.</Disclaimer>
      </Flex>
    </Section>
  );
}
