import { ReactNode } from "react";
import { motion, useReducedMotion, type Transition } from "framer-motion";

// Gentle "ease-out-expo"-ish curve shared across the app's motion.
export const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
export const PAGE_TRANSITION: Transition = { duration: 0.32, ease: EASE };

/**
 * Wraps routed content so it slides/fades in on entry and out on exit.
 * Place inside an <AnimatePresence mode="wait"> keyed by the route path.
 * Honors prefers-reduced-motion (renders static).
 */
export function PageTransition({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, y: -10 }}
      transition={PAGE_TRANSITION}
    >
      {children}
    </motion.div>
  );
}

// Stagger helpers for orchestrated entrances (e.g. the landing hero).
export const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.11, delayChildren: 0.08 } },
};

export const staggerItem = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};
