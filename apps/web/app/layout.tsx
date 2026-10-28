import type { Metadata, Viewport } from "next";
import { DM_Mono, DM_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { Providers } from "@/components/providers";
import { TOKENS } from "@/lib/design/tokens";
import { serverEnv } from "@/lib/env";
import { getThemeChoice } from "@/lib/theme";
import "./globals.css";

// DESIGN.md §4: DM Sans for everything, DM Mono only for IDs, numbers and code. next/font
// downloads them at build time and serves them from this origin (CSP font-src 'self').
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: "variable",
  style: ["normal", "italic"],
  variable: "--font-dm-sans",
  display: "swap",
});
const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

// Fail the build / server render if any env var is missing or malformed.
serverEnv();

export const metadata: Metadata = {
  title: { default: "BrandLens", template: "%s · BrandLens" },
  description: "Pre-publication brand governance with cited findings.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: TOKENS.light.bg },
    { media: "(prefers-color-scheme: dark)", color: TOKENS.dark.bg },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = await getThemeChoice();
  return (
    <html
      lang="en"
      data-theme={theme === "system" ? undefined : theme}
      className={`${dmSans.variable} ${dmMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
        <Toaster
          position="top-right"
          offset={{ top: 64 }}
          theme={theme === "system" ? "system" : theme}
          closeButton
          toastOptions={{ classNames: { title: "text-sm", description: "text-fg-muted text-xs" } }}
        />
      </body>
    </html>
  );
}
