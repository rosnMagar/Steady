import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Segmented, Tag, Flex } from "antd";
import { Section, Card, Button } from "../../components/ui";

const { CheckableTag } = Tag;

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
        <Card className="p-6 text-center">
          <div className="text-4xl">💚</div>
          <div className="text-lg font-semibold t-text" style={{ marginTop: "0.75rem" }}>Thanks for checking in</div>
          <p className="text-sm t-muted" style={{ marginTop: "0.25rem" }}>That helps Steady learn what a heavy day looks like for you.</p>
          <div style={{ marginTop: "1.25rem" }}><Button onClick={() => nav("/app")}>Back to Today</Button></div>
        </Card>
      </Section>
    );

  return (
    <Section>
      <Flex vertical gap={20}>
        <h1 className="text-2xl font-bold t-text" style={{ letterSpacing: "-0.01em", margin: 0 }}>How heavy did today feel?</h1>

        <Segmented
          block
          size="large"
          value={stress ?? 0}
          onChange={(v) => setStress(Number(v))}
          options={FACES.map((f) => ({
            value: f.v,
            label: (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "0.35rem 0" }}>
                <span style={{ fontSize: "1.5rem" }}>{f.emoji}</span>
                <span className="text-xs t-muted">{f.label}</span>
              </div>
            ),
          }))}
        />

        <div>
          <div className="text-sm font-medium t-text" style={{ marginBottom: "0.5rem" }}>Anything behind it? (optional)</div>
          <Flex wrap gap={8}>
            {TAGS.map((t) => (
              <CheckableTag
                key={t}
                checked={tags.includes(t)}
                onChange={() => toggle(t)}
                style={{ padding: "0.4rem 0.75rem", borderRadius: 9999, border: "1px solid rgb(var(--border))", fontSize: "0.875rem" }}
              >
                {t}
              </CheckableTag>
            ))}
          </Flex>
        </div>

        <Button className="w-full" disabled={stress === null} onClick={() => setDone(true)}>
          Done
        </Button>
        <p className="text-center text-xs t-muted" style={{ margin: 0 }}>Takes about 10 seconds. You can skip any day.</p>
      </Flex>
    </Section>
  );
}
