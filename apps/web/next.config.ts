import type { NextConfig } from "next";

// P15 security headers. Scripts keep 'unsafe-inline' because App Router emits inline bootstrap
// scripts and every page is dynamic (nonces would need a per-request proxy rewrite); everything
// else is locked to self + the Supabase project (REST, Storage signed URLs, Realtime websocket).
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseWs = supabase.replace(/^http/, "ws");
const dev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} https://vercel.live`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase}`,
  "font-src 'self' data:",
  "media-src 'self'", // the landing demo video is served from /demo, same origin only
  `connect-src 'self' ${supabase} ${supabaseWs} https://vercel.live wss://ws-us3.pusher.com`,
  "frame-src https://vercel.live",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // Cache Components is off: every Errata page is per-user and session-dependent (PROGRESS
  // decision, P02).
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Uploads are server-action bodies; lib/limits.ts keeps files under 4 MB (Vercel caps at 4.5 MB).
  experimental: { serverActions: { bodySizeLimit: "4.5mb" } },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
