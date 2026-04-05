import type { Metadata, Viewport } from "next";
import "./globals.css";
import OfflineBanner from "@/components/OfflineBanner";

export const metadata: Metadata = {
  title: "WolfXM Propose",
  description: "From job site to signed proposal — in minutes",
  manifest: "/manifest.json",
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "WolfXM",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-gray-50 antialiased">
        <OfflineBanner />
        {children}
      </body>
    </html>
  );
}
