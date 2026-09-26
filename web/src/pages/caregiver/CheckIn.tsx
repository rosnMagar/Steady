import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Section, Card, Button } from "../../components/ui";

const FACES = [
  { v: 1, emoji: "😌", label: "Light" },
  { v: 2, emoji: "🙂", label: "Okay" },
  { v: 3, emoji: "😐", label: "So-so" },
  { v: 4, emoji: "😟", label: "Heavy" },
  { v: 5, emoji: "😣", label: "Very heavy" },
];
const TAGS = ["Poor sleep", "Worry", "Appointments", "No time for me", "Physical strain", "Money"];

export function CheckIn() {
  const [stress, setStress] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const nav = useNavigate();

  const toggle = (t: string) => setTags((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));

  if (done)
    return (
      <Section>
        <Card className="p-8 text-center">
          <div className="text-4xl">💚</div>
          <div className="mt-3 text-lg font-semibold text-text">Thanks for checking in</div>
          <p className="mt-1 text-sm text-muted">That helps Steady learn what a heavy day looks like for you.</p>
          <Button className="mt-5" onClick={() => nav("/app")}>Back to Today</Button>
        </Card>
      </Section>
    );

  return (
    <Section className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight text-text">How heavy did today feel?</h1>

      <div className="grid grid-cols-5 gap-2">
        {FACES.map((f) => (
          <button
            key={f.v} onClick={() => setStress(f.v)}
            className={`flex flex-col items-center gap-1 py-3 rounded-xl border min-h-[44px] transition ${
              stress === f.v ? "border-accent bg-accent-soft" : "border-border bg-surface"
            }`}
          >
            <span className="text-2xl">{f.emoji}</span>
            <span className="text-[11px] text-muted">{f.label}</span>
          </button>
        ))}
      </div>

      <div>
        <div className="text-sm font-medium text-text mb-2">Anything behind it? (optional)</div>
        <div className="flex flex-wrap gap-2">
          {TAGS.map((t) => (
            <button
              key={t} onClick={() => toggle(t)}
              className={`px-3 py-2 rounded-full text-sm border min-h-[44px] transition ${
                tags.includes(t) ? "border-accent bg-accent-soft text-accent" : "border-border text-muted"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <Button className="w-full" disabled={stress === null} onClick={() => setDone(true)}>
        Done
      </Button>
      <p className="text-center text-xs text-muted">Takes about 10 seconds. You can skip any day.</p>
    </Section>
  );
}
