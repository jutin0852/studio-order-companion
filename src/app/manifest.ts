import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Studio — Order companion",
    short_name: "Studio",
    description: "A calm workspace for confirmed paid orders.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f766e",
    icons: [
      { src: "/icons/studio-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/studio-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
