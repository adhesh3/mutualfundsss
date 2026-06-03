"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LineChart, ListFilter, Landmark, UserCog, TrendingUp, Wallet, Sparkles, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/analyze", label: "Analyze", icon: LineChart },
  { href: "/screener", label: "Screener", icon: ListFilter },
  { href: "/portfolio", label: "Portfolio", icon: Wallet },
  { href: "/nfo", label: "NFOs", icon: Sparkles },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/fixed-income", label: "Fixed Income", icon: Landmark },
  { href: "/profile", label: "Profile", icon: UserCog },
];

export function SiteNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="container flex h-14 items-center gap-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <TrendingUp className="h-5 w-5 text-primary" />
          <span>Fund Analyzer</span>
        </Link>
        <nav className="flex flex-1 gap-1 overflow-x-auto">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
