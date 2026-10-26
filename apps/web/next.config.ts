import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is off: every BrandLens page is per-user and session-dependent (PROGRESS
  // decision, P02).
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
