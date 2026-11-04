"use client";
// Sonner, restyled (Design v2 §9.13): follows the next-themes choice, sits on
// a translucent material with the status shown by a tinted icon only (no
// rich colour slabs), bottom-right on desktop and top-center on a phone
// where the floating tab bar owns the bottom edge.
import { Toaster } from "sonner";
import { useTheme } from "next-themes";
import { useMediaQuery } from "@/hooks/use-media-query";

export function ThemedToaster(props: React.ComponentProps<typeof Toaster>) {
  const { resolvedTheme } = useTheme();
  const narrow = useMediaQuery("(max-width: 767px)");
  return (
    <Toaster
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position={narrow ? "top-center" : "bottom-right"}
      duration={4000}
      offset={narrow ? 12 : 20}
      toastOptions={{
        classNames: {
          toast: "!rounded-overlay !material-popover !shadow-e3 !border-0 !px-4 !py-3 !gap-3 !text-body !text-foreground",
          title: "!font-semibold",
          description: "!text-footnote !text-muted-foreground",
          actionButton: "!rounded-pill !bg-brand !text-white !h-7 !px-3 !text-footnote !font-semibold",
          cancelButton: "!rounded-pill !bg-muted !text-foreground !h-7 !px-3 !text-footnote",
          closeButton: "!border-border !bg-popover !text-muted-foreground hover:!text-foreground",
          success: "[&_[data-icon]]:text-success",
          warning: "[&_[data-icon]]:text-warning",
          error: "[&_[data-icon]]:text-destructive",
          info: "[&_[data-icon]]:text-brand-text",
        },
      }}
      {...props}
    />
  );
}
