"use client";
// Count-up numeral (UI polish, 10/12/26 — Framer Motion). Plain integers
// ("441", "1,250") roll up from 0 when they first appear; anything else
// (currency, %, "—", "4/5") renders as given. Reduced motion: no roll.
import * as React from "react";
import { animate, useReducedMotion } from "framer-motion";

const INT = /^\d{1,3}(,\d{3})*$|^\d+$/;

export function CountUp({ value }: { value: React.ReactNode }) {
  const reduce = useReducedMotion();
  const text = typeof value === "number" ? value.toLocaleString("en-US") : value;
  const target = typeof text === "string" && INT.test(text) ? Number(text.replace(/,/g, "")) : null;
  const [shown, setShown] = React.useState<React.ReactNode>(target !== null && !reduce && target > 0 ? "0" : text);

  React.useEffect(() => {
    if (target === null || reduce || target === 0) { setShown(text); return; }
    const controls = animate(0, target, {
      duration: Math.min(1.2, 0.5 + target / 2000),
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setShown(Math.round(v).toLocaleString("en-US")),
    });
    return () => controls.stop();
  }, [target, reduce, text]);

  return <>{shown}</>;
}
