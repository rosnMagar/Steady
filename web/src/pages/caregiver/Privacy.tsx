import { useState } from "react";
import { Download, Trash2, PauseCircle } from "lucide-react";
import { Flex, App, Modal } from "antd";
import { api } from "../../api/client";
import { Section, Card, Button, Disclaimer } from "../../components/ui";

const PERSON_ID = "p_demo";

/** One row of the privacy control list. Keeps the icon/label/action rhythm identical across rows. */
function ControlRow({ icon, label, hint, action }: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  action: React.ReactNode;
}) {
  return (
    <Card className="p-4" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        {icon}
        <div style={{ minWidth: 0 }}>
          <div className="text-sm t-text">{label}</div>
          {hint && <div className="text-xs t-muted">{hint}</div>}
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>{action}</div>
    </Card>
  );
}

export function Privacy() {
  const { message } = App.useApp();
  const [busy, setBusy] = useState<"export" | "delete" | null>(null);

  const handleExport = async () => {
    setBusy("export");
    try {
      const data = await api.exportData(PERSON_ID);
      // Hand the file straight to the browser — an export you can't keep isn't an export.
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `steady-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      message.success("Downloaded. It's yours to keep.");
    } catch {
      message.error("Couldn't build your export. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = () => {
    // Irreversible, so it always goes through an explicit confirm — never a single tap.
    Modal.confirm({
      title: "Delete all your data?",
      content: "This removes every day of wearable data, check-in, and note Steady holds for you. "
             + "It can't be undone.",
      okText: "Delete everything",
      okButtonProps: { danger: true },
      cancelText: "Keep my data",
      onOk: async () => {
        setBusy("delete");
        try {
          const r = await api.deleteData(PERSON_ID);
          message.success(r.deleted > 0 ? `Deleted ${r.deleted} records.` : "Your data has been cleared.");
        } catch {
          message.error("Couldn't delete right now. Please try again.");
        } finally {
          setBusy(null);
        }
      },
    });
  };

  return (
    <Section>
      <Flex vertical gap={20} className="stagger">
        <h1 className="text-2xl font-bold t-text" style={{ letterSpacing: "-0.01em", margin: 0 }}>Your data, your call</h1>

        <Card className="p-4">
          <div className="text-sm font-medium t-text">What Steady stores</div>
          <p className="text-sm t-muted" style={{ marginTop: "0.25rem", marginBottom: 0 }}>
            One row per day: your step count, resting heart rate, sleep length, and any check-in you send.
            Stored under a random ID, never your name. No location, no raw heart-rate streams.
          </p>
        </Card>

        <Flex vertical gap={12}>
          <ControlRow
            icon={<Download size={20} className="t-accent" aria-hidden />}
            label="Export everything Steady has"
            hint="Downloads a JSON file of every row we hold."
            action={
              <Button variant="outline" className="text-sm" onClick={handleExport} disabled={busy !== null}>
                {busy === "export" ? "Preparing…" : "Export"}
              </Button>
            }
          />
          <ControlRow
            icon={<PauseCircle size={20} className="t-accent" aria-hidden />}
            label="Pause syncing"
            // Honest: the phone Shortcut is what sends data, so pausing happens there, not here.
            hint="Turn off the Steady automation in the Shortcuts app on your iPhone."
            action={<span className="text-xs t-muted">On your iPhone</span>}
          />
          <ControlRow
            icon={<Trash2 size={20} className="t-headsup" aria-hidden />}
            label="Delete all my data"
            hint="Permanent — we keep nothing."
            action={
              <Button variant="outline" className="text-sm" onClick={handleDelete} disabled={busy !== null}>
                {busy === "delete" ? "Deleting…" : "Delete"}
              </Button>
            }
          />
        </Flex>

        <Disclaimer>Steady is caregiver support, not a diagnosis or a medical device.</Disclaimer>
      </Flex>
    </Section>
  );
}
