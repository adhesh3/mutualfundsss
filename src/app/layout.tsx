import type { Metadata } from "next";
import "./globals.css";
import { SiteNav } from "@/components/site-nav";
import { DISCLAIMER } from "@/lib/config";

export const metadata: Metadata = {
  title: "Fund Analyzer",
  description: "Personal mutual fund & NFO analysis with SIP/lumpsum and allocation guidance.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background antialiased">
        <SiteNav />
        <main className="container py-6">{children}</main>
        <footer className="container border-t py-6 text-xs text-muted-foreground">{DISCLAIMER}</footer>
      </body>
    </html>
  );
}
