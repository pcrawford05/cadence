import type { Metadata, Viewport } from "next";
import Nav from "@/components/Nav";
import Shortcuts from "@/components/Shortcuts";
import Feedback from "@/components/Feedback";
import Splash from "@/components/Splash";
import { headers } from "next/headers";
import { isDemo } from "@/lib/supabase";
import { currentUser } from "@/lib/session";
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

const LANDING = ["/welcome", "/login", "/privacy"];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Signed out (or on a landing path), the page is the marketing site: no tabs, no splash, no app shortcuts.
  const path = (await headers()).get("x-pathname") ?? "";
  const app = !LANDING.includes(path) && !!(await currentUser());
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Cold open only: decide before first paint so the app never flashes behind the splash. */}
        {app && <script dangerouslySetInnerHTML={{ __html: `try{if(!sessionStorage.getItem('cadence.launched'))document.documentElement.setAttribute('data-splash','')}catch(e){}` }} />}
      </head>
      <body className="min-h-screen font-sans">
        {app && <Splash />}
        {app && isDemo() && (
          <div className="bg-accent/10 py-1 text-center text-xs text-accent">Demo mode: sample data, nothing is saved</div>
        )}
        {app ? (
          <>
            <Nav />
            <Shortcuts />
            <Feedback />
            <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 sm:pb-12">{children}</main>
          </>
        ) : (
          children
        )}
        <script dangerouslySetInnerHTML={{ __html: `if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{})}` }} />
      </body>
    </html>
  );
}
