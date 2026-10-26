import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { serverEnv } from "@/lib/env";
import "./globals.css";

// Fail the build / server render if any env var is missing or malformed.
serverEnv();

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BrandLens",
  description: "Pre-publication brand governance with cited findings.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
