import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Activity } from "lucide-react";
import { EASE } from "./PageTransition";

/** Full-screen branded splash shown once on app load, then fades away. */
export function SplashScreen() {
  const [show, setShow] = useState(true);
  const reduce = useReducedMotion();

  useEffect(() => {
    const t = setTimeout(() => setShow(false), reduce ? 700 : 1900);
    return () => clearTimeout(t);
  }, [reduce]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="splash"
          aria-hidden
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          style={{
            position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "none",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 22, background: "rgb(var(--bg))",
          }}
        >
          {/* Pulsing rings behind a solid brand mark */}
          <div style={{ position: "relative", display: "grid", placeItems: "center", width: 96, height: 96 }}>
            {!reduce && [0, 1].map((i) => (
              <motion.span
                key={i}
                style={{ position: "absolute", width: 96, height: 96, borderRadius: "50%", border: "2px solid rgb(var(--accent))" }}
                initial={{ scale: 0.5, opacity: 0.55 }}
                animate={{ scale: 1.7, opacity: 0 }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay: i * 0.9 }}
              />
            ))}
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: EASE }}
              style={{ width: 60, height: 60, borderRadius: "50%", background: "rgb(var(--accent))", display: "grid", placeItems: "center", color: "#fff", boxShadow: "0 8px 24px rgb(var(--accent) / 0.4)" }}
            >
              <Activity size={28} />
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.5, ease: EASE }}
            className="text-3xl font-bold t-text"
            style={{ letterSpacing: "-0.02em" }}
          >
            Steady
          </motion.div>

          {!reduce && (
            <div style={{ width: 140, height: 3, borderRadius: 9999, background: "rgb(var(--border))", overflow: "hidden" }}>
              <motion.div
                style={{ height: "100%", background: "rgb(var(--accent))" }}
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 1.6, ease: EASE }}
              />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
