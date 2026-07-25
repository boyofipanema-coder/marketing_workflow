import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for @opennextjs/cloudflare
  output: "standalone",
  // Disable image optimization for Cloudflare Workers compatibility
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
