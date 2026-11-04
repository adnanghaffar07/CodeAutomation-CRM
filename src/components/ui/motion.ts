// Framer Motion spring presets (Design v2 §7). One vocabulary for every
// moving part so the app feels like one product:
//   snappy — thumbs, indicators, layout shifts (segmented, tabs, tab bar)
//   smooth — panels, sheets, reorder
//   bouncy — ONLY celebratory moments (deal won)
// <MotionConfig reducedMotion="user"> in theme-provider.tsx swaps these for
// instant changes when the OS asks for reduced motion.
export const spring = {
  snappy: { type: "spring", visualDuration: 0.35, bounce: 0.15 } as const,
  smooth: { type: "spring", visualDuration: 0.4, bounce: 0 } as const,
  bouncy: { type: "spring", visualDuration: 0.5, bounce: 0.3 } as const,
};
