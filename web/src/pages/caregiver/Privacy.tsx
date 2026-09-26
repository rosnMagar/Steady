import { Download, Trash2, PauseCircle } from "lucide-react";
import { Section, Card, Button, Disclaimer } from "../../components/ui";

export function Privacy() {
  return (
    <Section className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight text-text">Your data, your call</h1>

      <Card className="p-4">
        <div className="text-sm font-medium text-text">What Steady stores</div>
        <p className="mt-1 text-sm text-muted">
          One row per day: your step count, resting heart rate, sleep length, and any check-in you send.
          Stored under a random ID, never your name. No location, no raw heart-rate streams.
        </p>
      </Card>

      <div className="space-y-3">
        <Card className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3"><Download size={20} className="text-accent" />
            <span className="text-sm text-text">Export everything Steady has</span></div>
          <Button variant="outline" className="text-sm">Export</Button>
        </Card>
        <Card className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3"><PauseCircle size={20} className="text-accent" />
            <span className="text-sm text-text">Pause syncing</span></div>
          <Button variant="outline" className="text-sm">Pause</Button>
        </Card>
        <Card className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3"><Trash2 size={20} className="text-headsup" />
            <span className="text-sm text-text">Delete all my data</span></div>
          <Button variant="outline" className="text-sm">Delete</Button>
        </Card>
      </div>

      <Disclaimer>Steady is caregiver support, not a diagnosis or a medical device.</Disclaimer>
    </Section>
  );
}
