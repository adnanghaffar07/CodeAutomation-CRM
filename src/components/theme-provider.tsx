"use client";
import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { MotionConfig } from "framer-motion";
import { TooltipProvider } from "@/components/ui/tooltip";

/** Keeps the browser / PWA chrome colour (<meta name="theme-color">) in step
 *  with the app theme, including when the user overrides the OS scheme.
 *  Purely visual: writes one meta tag, reads nothing. */
function ThemeColorSync() {
  const { resolvedTheme } = useTheme();
  React.useEffect(() => {
    if (!resolvedTheme) return;
    const color = resolvedTheme === "dark" ? "#111113" : "#F5F5F7";
    const metas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
    if (metas.length === 0) {
      const m = document.createElement("meta");
      m.name = "theme-color";
      document.head.appendChild(m);
      metas.push(m);
    }
    for (const m of metas) m.content = color;
  }, [resolvedTheme]);
  return null;
}

export function ThemeProvider({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props}>
      <ThemeColorSync />
      {/* Framer springs become instant/opacity-only when the OS asks for
          reduced motion. */}
      <MotionConfig reducedMotion="user">
        <TooltipProvider delayDuration={400} skipDelayDuration={150}>
          {children}
        </TooltipProvider>
      </MotionConfig>
    </NextThemesProvider>
  );
}
