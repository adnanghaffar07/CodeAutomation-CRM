import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemedToaster } from "@/components/themed-toaster";
import { DENSITY_BOOT_SCRIPT } from "@/lib/appearance";

// Inter is the Windows face in the system-first stack (tailwind fontFamily.sans);
// self-hosted through next/font, no layout shift.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F5F7" },
    { media: "(prefers-color-scheme: dark)", color: "#111113" },
  ],
};

export const metadata: Metadata = {
  title: { default: "CodeAutomation CRM", template: "%s · CodeAutomation CRM" },
  description: "CodeAutomation sales and business development CRM.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning data-density="comfortable" data-shape="soft" className={inter.variable}>
      <head>
        {/* Density before first paint (src/lib/appearance.ts); next-themes injects the theme script. */}
        <script dangerouslySetInnerHTML={{ __html: DENSITY_BOOT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange enableColorScheme>
          {children}
          <ThemedToaster closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
