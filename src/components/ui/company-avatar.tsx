// Company initials avatar (UI polish, 10/12/26): two letters on a soft chip
// tint, the hue picked stably from the name so a company keeps its colour on
// every list. Decorative — the name always sits next to it.
import { cn } from "@/components/ui/cn";
import { chipFor, type ChipAccent } from "@/components/ui/stat";

const HUES: ChipAccent[] = ["blue", "violet", "sky", "emerald", "amber", "rose"];

export function companyInitials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function hueFor(name: string): ChipAccent {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return HUES[h % HUES.length];
}

export function CompanyAvatar({ name, size = "md", className }: { name: string; size?: "sm" | "md"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-control font-semibold tracking-tight",
        size === "sm" ? "size-7 text-caption2" : "size-9 text-caption",
        chipFor("neutral", hueFor(name)),
        className,
      )}
    >
      {companyInitials(name)}
    </span>
  );
}
