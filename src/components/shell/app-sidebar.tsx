"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  Building2,
  FileText,
  LayoutDashboard,
  Network,
  Radar,
  Rss,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RadarMark } from "@/components/brand/radar-mark";
import { Badge } from "@/components/ui/badge";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/discover", label: "Discover prospects", icon: Radar },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/referral", label: "Referral graph", icon: Network },
  { href: "/saved", label: "Saved prospects", icon: Bookmark },
  { href: "/sources", label: "Signal sources", icon: Rss },
  { href: "/reports", label: "Reports", icon: FileText },
];

export function AppSidebar({
  workspaceName,
  category,
  signalCount,
  savedCount,
  contactCount,
  failingSources,
}: {
  workspaceName: string;
  category: string | null;
  signalCount: number;
  savedCount: number;
  contactCount: number;
  failingSources: number;
}) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[252px] flex-col border-r border-white/[0.06] bg-[#070a0e]/95 backdrop-blur-xl md:flex">
      <div className="px-5 pb-5 pt-6">
        <Link href="/dashboard" className="group flex items-center gap-2.5">
          <span className="text-signal-lime transition-transform group-hover:rotate-12">
            <RadarMark size={30} />
          </span>
          <span className="flex flex-col">
            <span className="text-[13px] font-semibold tracking-[0.16em] text-foreground">SIGNAL RADAR</span>
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/70">GTM intelligence</span>
          </span>
        </Link>
      </div>

      <div className="mx-4 mb-5 rounded-lg border border-white/[0.07] bg-white/[0.025] p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[12px] font-medium text-foreground/90">{workspaceName}</p>
            <p className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground/60">
              {category ?? "No ICP yet"}
            </p>
          </div>
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", signalCount > 0 ? "bg-signal-lime" : "bg-muted-foreground/40")} />
        </div>
        <div className="mt-2.5 flex items-center gap-1.5">
          {signalCount > 0 ? (
            <Badge variant="primary" className="gap-1 px-1.5 py-0 font-mono text-[9px]">
              <span className="h-1 w-1 animate-pulse rounded-full bg-signal-lime" /> LIVE
            </Badge>
          ) : (
            <Badge variant="outline" className="font-mono text-[9px]">NO DATA</Badge>
          )}
          {contactCount > 0 && (
            <span className="font-mono text-[9px] text-muted-foreground/60">{contactCount} contacts</span>
          )}
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors",
                active
                  ? "bg-white/[0.055] text-foreground"
                  : "text-muted-foreground hover:bg-white/[0.035] hover:text-foreground/85",
              )}
            >
              {active && <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-signal-lime" />}
              <Icon className={cn("h-[15px] w-[15px]", active ? "text-signal-lime" : "text-muted-foreground/70 group-hover:text-foreground/70")} strokeWidth={1.8} />
              <span className="flex-1">{item.label}</span>
              {item.href === "/saved" && savedCount > 0 && (
                <span className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-[9px] text-foreground/70">{savedCount}</span>
              )}
              {item.href === "/sources" && failingSources > 0 && (
                <span className="h-1.5 w-1.5 rounded-full bg-[#fb7185]" title={`${failingSources} source(s) need attention`} />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 px-3 pb-3">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors",
            pathname.startsWith("/settings")
              ? "bg-white/[0.055] text-foreground"
              : "text-muted-foreground hover:bg-white/[0.035] hover:text-foreground/85",
          )}
        >
          <Settings className="h-[15px] w-[15px] text-muted-foreground/70" strokeWidth={1.8} />
          Settings & scoring
        </Link>
        <div className="mx-1 rounded-lg border border-white/[0.055] bg-[#080c10] p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
            <ShieldCheck className="h-3 w-3 text-signal-mint/80" />
            Private by default
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/55">
            Contacts and graph data never appear in shared reports.
          </p>
        </div>
        <Link
          href="/discover"
          className="mt-1 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/[0.1] px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70 transition-colors hover:border-signal-lime/30 hover:text-signal-lime"
        >
          <Sparkles className="h-3 w-3" /> New ICP
        </Link>
      </div>
    </aside>
  );
}
