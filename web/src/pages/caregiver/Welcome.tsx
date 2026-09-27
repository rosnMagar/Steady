import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, X } from "lucide-react";
import { Checkbox, Flex } from "antd";
import { Section, Card, Button } from "../../components/ui";

const COLLECTED = ["Daily step count", "Resting heart rate", "Sleep length", "Your daily check-in"];
const NOT_COLLECTED = ["Your location", "Raw heart-rate stream", "Messages or contacts", "Anything shared with employers"];

export function Welcome() {
  const [agreed, setAgreed] = useState(false);
  const nav = useNavigate();
  return (
    <Section>
      <Flex vertical gap={20}>
        <div>
          <h1 className="text-2xl font-bold t-text" style={{ letterSpacing: "-0.01em", margin: 0 }}>Steady is on your side</h1>
          <p className="t-muted" style={{ marginTop: "0.5rem" }}>
            It watches for signs that caregiving is getting heavy, so support reaches you before a crisis —
            never to judge or diagnose you.
          </p>
        </div>

        <Card className="p-4">
          <div className="text-sm font-medium t-text">What Steady uses</div>
          <Flex vertical gap={6} style={{ marginTop: "0.5rem" }}>
            {COLLECTED.map((c) => (
              <div key={c} className="text-sm t-text" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Check size={16} className="t-steady" /> {c}
              </div>
            ))}
          </Flex>
          <div className="text-sm font-medium t-text" style={{ marginTop: "1rem" }}>What it never touches</div>
          <Flex vertical gap={6} style={{ marginTop: "0.5rem" }}>
            {NOT_COLLECTED.map((c) => (
              <div key={c} className="text-sm t-muted" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <X size={16} className="t-muted" /> {c}
              </div>
            ))}
          </Flex>
        </Card>

        <Checkbox checked={agreed} onChange={(e) => setAgreed(e.target.checked)}>
          <span className="text-sm t-text">I understand Steady is a support tool, not medical advice, and I can delete my data anytime.</span>
        </Checkbox>

        <Button className="w-full" disabled={!agreed} onClick={() => nav("/app/connect")}>
          Get started
        </Button>
      </Flex>
    </Section>
  );
}
