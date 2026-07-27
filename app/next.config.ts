import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Initialize one shared Miniflare context before Next evaluates layouts and
// pages concurrently. Without this, each getCloudflareContext() call can open
// the same local D1 file and race on SQLite WAL recovery.
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  // Required for @opennextjs/cloudflare
  output: "standalone",
  // Disable image optimization for Cloudflare Workers compatibility
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
