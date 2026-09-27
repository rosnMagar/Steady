import { Link } from "react-router-dom";
import { Smartphone, LayoutDashboard, ArrowRight, Activity } from "lucide-react";
import { Row, Col } from "antd";
import { motion, useReducedMotion } from "framer-motion";
import { Card } from "../components/ui";
import { staggerContainer, staggerItem, EASE } from "../components/PageTransition";

/** Softly drifting blurred color glow used as the hero backdrop. */
function Glow({ color, size, top, left, delay = 0, drift }: {
  color: string; size: number; top: string; left: string; delay?: number; drift: [number, number];
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      aria-hidden
      style={{
        position: "absolute", top, left, width: size, height: size, borderRadius: "50%",
        background: color, filter: "blur(90px)", pointerEvents: "none", opacity: 0.55,
      }}
      animate={reduce ? undefined : { x: [0, drift[0], 0], y: [0, drift[1], 0] }}
      transition={{ duration: 16, repeat: Infinity, repeatType: "mirror", ease: "easeInOut", delay }}
    />
  );
}

export function Landing() {
  return (
    <div className="min-h-screen" style={{ position: "relative", overflow: "hidden", background: "rgb(var(--bg))", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 1.5rem" }}>
      <Glow color="rgb(var(--accent) / 0.35)" size={420} top="-8%" left="-6%" drift={[40, 30]} />
      <Glow color="rgb(var(--steady) / 0.28)" size={360} top="55%" left="70%" delay={2} drift={[-50, -25]} />
      <Glow color="rgb(var(--building) / 0.20)" size={300} top="70%" left="10%" delay={4} drift={[30, -40]} />

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="text-center"
        style={{ position: "relative", zIndex: 1, maxWidth: "32rem", margin: "0 auto" }}
      >
        <motion.div variants={staggerItem} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "0.35rem 0.85rem", borderRadius: 9999, border: "1px solid rgb(var(--border))", background: "rgb(var(--surface) / 0.6)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}>
          <Activity size={14} className="t-accent" />
          <span className="text-xs t-muted">Caregiver strain, seen days ahead</span>
        </motion.div>

        <motion.h1 variants={staggerItem} className="text-4xl font-bold t-text" style={{ letterSpacing: "-0.02em", margin: "1rem 0 0" }}>Steady</motion.h1>

        <motion.p variants={staggerItem} className="text-lg t-muted" style={{ marginTop: "0.75rem" }}>
          Family caregivers are invisible to the health system. Steady reads a caregiver's own
          wearable signals, sees strain building days ahead, and connects them to real support.
        </motion.p>

        <Row gutter={[16, 16]} style={{ marginTop: "2rem", textAlign: "left" }}>
          <Col xs={24} sm={12}>
            <motion.div variants={staggerItem} whileHover={{ y: -4 }} transition={{ duration: 0.25, ease: EASE }} style={{ height: "100%" }}>
              <Link to="/app" className="no-underline">
                <Card interactive className="p-5" style={{ height: "100%" }}>
                  <Smartphone className="t-accent" size={22} />
                  <div className="font-semibold t-text" style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: 4 }}>
                    Caregiver app <ArrowRight size={16} />
                  </div>
                  <div className="text-sm t-muted" style={{ marginTop: "0.25rem" }}>The mobile experience a caregiver sees each day.</div>
                </Card>
              </Link>
            </motion.div>
          </Col>
          <Col xs={24} sm={12}>
            <motion.div variants={staggerItem} whileHover={{ y: -4 }} transition={{ duration: 0.25, ease: EASE }} style={{ height: "100%" }}>
              <Link to="/dashboard" className="no-underline">
                <Card interactive className="p-5" style={{ height: "100%" }}>
                  <LayoutDashboard className="t-accent" size={22} />
                  <div className="font-semibold t-text" style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: 4 }}>
                    Care-manager dashboard <ArrowRight size={16} />
                  </div>
                  <div className="text-sm t-muted" style={{ marginTop: "0.25rem" }}>The cohort view for a health plan or agency.</div>
                </Card>
              </Link>
            </motion.div>
          </Col>
        </Row>

        <motion.div variants={staggerItem}>
          <Link to="/methods" className="text-sm t-accent no-underline" style={{ display: "inline-block", marginTop: "1.5rem" }}>
            How it works &amp; honest limits →
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
