import type { Metadata, Viewport } from "next";
import Nav from "@/components/Nav";
import Shortcuts from "@/components/Shortcuts";
import { isDemo } from "@/lib/supabase";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cadence",
  description: "Keep up with the people who matter.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Cadence", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F5F0" },
    { media: "(prefers-color-scheme: dark)", color: "#111113" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        {isDemo() && (
          <div className="bg-accent/10 py-1 text-center text-xs text-accent">Demo mode: sample data, nothing is saved</div>
        )}
        <Nav />
        <Shortcuts />
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 sm:pb-12">{children}</main>
        <script dangerouslySetInnerHTML={{ __html: `if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{})}` }} />
      </body>
    </html>
  );
}
