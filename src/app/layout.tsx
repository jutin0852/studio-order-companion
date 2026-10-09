import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Studio — Order companion",
  description: "A calm workspace for confirmed paid orders.",
  icons: {
    icon: [
      { url: "/icons/studio-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/studio-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/studio-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" className={geist.variable}><body>{children}</body></html>;
}
