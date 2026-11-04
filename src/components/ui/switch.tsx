"use client";
// Design v2 §9.12 — an iOS-style switch with no extra dependency. The thumb
// springs across; the track fills with brand when on.
import * as React from "react";
import { cn } from "@/components/ui/cn";

export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, className, disabled, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "group relative inline-flex h-[22px] w-[38px] shrink-0 cursor-pointer items-center rounded-pill bg-fill-strong tap-clean transition-colors duration-base ease-standard aria-checked:bg-brand",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className="pointer-events-none block size-[18px] translate-x-[2px] rounded-pill bg-white shadow-[0_2px_4px_rgb(0_0_0/0.2),0_0_0_0.5px_rgb(0_0_0/0.04)] transition-transform duration-moderate ease-spring group-aria-checked:translate-x-[18px]"
      />
    </button>
  )
);
Switch.displayName = "Switch";
