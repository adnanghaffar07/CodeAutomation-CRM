"use client";
// Keeps an assignment page current: reloads its server data every 20 seconds while the tab is visible, and as soon as the
// tab comes back into view. Text typed into forms on the page is kept (a refresh only re-renders the server parts).
import * as React from "react";
import { useRouter } from "next/navigation";

const EVERY_MS = 20_000;

export function AutoRefresh() {
  const router = useRouter();
  React.useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") router.refresh(); };
    const timer = setInterval(refresh, EVERY_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [router]);
  return null;
}
