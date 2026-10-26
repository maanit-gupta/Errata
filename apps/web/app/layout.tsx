import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono, Newsreader } from "next/font/google";
import { Toaster } from "sonner";
import { serverEnv } from "@/lib/env";
import "./globals.css";

// Fail the build / server render if any env var is missing or malformed.
serverEnv();

const display = Newsreader({ variable: "--font-display", subsets: ["latin"], display: "swap" });
const body = DM_Sans({ variable: "--font-body", subsets: ["latin"], display: "swap" });
const code = JetBrains_Mono({ variable: "--font-code", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "BrandLens", template: "%s · BrandLens" },
  description: "Pre-publication brand governance with cited findings.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${code.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
