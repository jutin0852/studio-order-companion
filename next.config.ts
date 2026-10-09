import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep production checks isolated when the local preview owns the default .next directory.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  allowedDevOrigins: ["192.168.1.3", "192.168.1.3.nip.io"],
  devIndicators: false,
  // Keep the local preview accessible to phones without overlapping dev controls.
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
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
