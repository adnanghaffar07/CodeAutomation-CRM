"use client";
import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/components/ui/cn";

/** Flip the theme via `resolvedTheme` (so "System" users flip what they
 *  actually SEE), inside a short crossfade where the browser supports view
 *  transitions and motion is allowed. Shared by the button, ⌘⇧L and ⌘K. */
export function flipTheme(resolvedTheme: string | undefined, setTheme: (t: string) => void) {
  const next = resolvedTheme === "dark" ? "light" : "dark";
  applyThemeWithTransition(next, setTheme);
}

export function applyThemeWithTransition(next: string, setTheme: (t: string) => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (doc.startViewTransition && !reduce) doc.startViewTransition(() => setTheme(next));
  else setTheme(next);
}

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <div aria-hidden className={cn("inline-flex size-8 shrink-0 items-center justify-center text-[hsl(var(--chrome-muted))]", className)}>
        <span className="size-4 rounded-pill border-[1.5px] border-current opacity-40" />
      </div>
    );
  }
  const dark = resolvedTheme === "dark";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn("relative shrink-0 text-[hsl(var(--chrome-muted))] hover:text-[hsl(var(--chrome-fg))]", className)}
          onClick={() => flipTheme(resolvedTheme, setTheme)}
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          <Sun
            className={cn(
              "absolute transition-[opacity,transform] duration-base ease-standard",
              dark ? "rotate-90 scale-75 opacity-0" : "rotate-0 scale-100 opacity-100",
            )}
          />
          <Moon
            className={cn(
              "absolute transition-[opacity,transform] duration-base ease-standard",
              dark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-75 opacity-0",
            )}
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        Appearance <Kbd className="h-4 border-background/20 bg-transparent text-background/70 shadow-none">⌘⇧L</Kbd>
      </TooltipContent>
    </Tooltip>
  );
}
