import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, X } from "lucide-react";
import { Section, Card, Button } from "../../components/ui";

const COLLECTED = ["Daily step count", "Resting heart rate", "Sleep length", "Your daily check-in"];
const NOT_COLLECTED = ["Your location", "Raw heart-rate stream", "Messages or contacts", "Anything shared with employers"];

export function Welcome() {
  const [agreed, setAgreed] = useState(false);
  const nav = useNavigate();
  return (
    <Section className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text">Steady is on your side</h1>
        <p className="mt-2 text-muted">
          It watches for signs that caregiving is getting heavy, so support reaches you before a crisis —
          never to judge or diagnose you.
        </p>
      </div>

      <Card className="p-4">
        <div className="text-sm font-medium text-text">What Steady uses</div>
        <ul className="mt-2 space-y-1.5">
          {COLLECTED.map((c) => (
            <li key={c} className="flex items-center gap-2 text-sm text-text">
              <Check size={16} className="text-steady" /> {c}
            </li>
          ))}
        </ul>
        <div className="mt-4 text-sm font-medium text-text">What it never touches</div>
        <ul className="mt-2 space-y-1.5">
          {NOT_COLLECTED.map((c) => (
            <li key={c} className="flex items-center gap-2 text-sm text-muted">
              <X size={16} className="text-muted" /> {c}
            </li>
          ))}
        </ul>
      </Card>

      <label className="flex items-start gap-3 text-sm text-text px-1">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 h-5 w-5 accent-[rgb(var(--accent))]" />
        I understand Steady is a support tool, not medical advice, and I can delete my data anytime.
      </label>

      <Button className="w-full" disabled={!agreed} onClick={() => nav("/app/connect")}>
        Get started
      </Button>
    </Section>
  );
}
