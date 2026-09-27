import { Link } from "react-router-dom";
import { Smartphone, LayoutDashboard, ArrowRight } from "lucide-react";
import { Row, Col } from "antd";
import { Card, Section } from "../components/ui";

export function Landing() {
  return (
    <div style={{ minHeight: "100vh", background: "rgb(var(--bg))", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 1.5rem" }}>
      <Section className="text-center" >
        <div style={{ maxWidth: "32rem", margin: "0 auto" }}>
          <h1 className="text-4xl font-bold t-text" style={{ letterSpacing: "-0.02em", margin: 0 }}>Steady</h1>
          <p className="text-lg t-muted" style={{ marginTop: "0.75rem" }}>
            Family caregivers are invisible to the health system. Steady reads a caregiver's own
            wearable signals, sees strain building days ahead, and connects them to real support.
          </p>

          <Row gutter={[16, 16]} style={{ marginTop: "2rem", textAlign: "left" }}>
            <Col xs={24} sm={12}>
              <Link to="/app" className="no-underline">
                <Card interactive className="p-5" style={{ height: "100%" }}>
                  <Smartphone className="t-accent" size={22} />
                  <div className="font-semibold t-text" style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: 4 }}>
                    Caregiver app <ArrowRight size={16} />
                  </div>
                  <div className="text-sm t-muted" style={{ marginTop: "0.25rem" }}>The mobile experience a caregiver sees each day.</div>
                </Card>
              </Link>
            </Col>
            <Col xs={24} sm={12}>
              <Link to="/dashboard" className="no-underline">
                <Card interactive className="p-5" style={{ height: "100%" }}>
                  <LayoutDashboard className="t-accent" size={22} />
                  <div className="font-semibold t-text" style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: 4 }}>
                    Care-manager dashboard <ArrowRight size={16} />
                  </div>
                  <div className="text-sm t-muted" style={{ marginTop: "0.25rem" }}>The cohort view for a health plan or agency.</div>
                </Card>
              </Link>
            </Col>
          </Row>

          <Link to="/methods" className="text-sm t-accent no-underline" style={{ display: "inline-block", marginTop: "1.5rem" }}>
            How it works &amp; honest limits →
          </Link>
        </div>
      </Section>
    </div>
  );
}
