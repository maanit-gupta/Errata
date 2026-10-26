import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Toaster } from "sonner";
import { Providers } from "@/components/providers";
import { serverEnv } from "@/lib/env";
import { getThemeChoice } from "@/lib/theme";
import "./globals.css";

// Fail the build / server render if any env var is missing or malformed.
serverEnv();

export const metadata: Metadata = {
  title: { default: "BrandLens", template: "%s · BrandLens" },
  description: "Pre-publication brand governance with cited findings.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = await getThemeChoice();
  return (
    <html
      lang="en"
      data-theme={theme === "system" ? undefined : theme}
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
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
