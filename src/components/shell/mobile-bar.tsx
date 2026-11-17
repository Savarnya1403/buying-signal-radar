"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, Building2, FileText, LayoutDashboard, Menu, Network, Radar, Rss, Settings } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RadarMark } from "@/components/brand/radar-mark";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/discover", label: "Discover prospects", icon: Radar },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/referral", label: "Referral graph", icon: Network },
  { href: "/saved", label: "Saved prospects", icon: Bookmark },
  { href: "/sources", label: "Signal sources", icon: Rss },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Settings & scoring", icon: Settings },
];

export function MobileBar({ savedCount }: { savedCount: number }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-white/[0.07] bg-[#070a0e]/95 px-4 backdrop-blur-xl md:hidden">
      <Link href="/dashboard" className="flex items-center gap-2 text-signal-lime">
        <RadarMark size={24} />
        <span className="text-[12px] font-semibold tracking-[0.14em] text-foreground">SIGNAL RADAR</span>
      </Link>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button className="rounded-lg border border-white/10 p-2 text-muted-foreground" aria-label="Open navigation">
            <Menu className="h-4 w-4" />
          </button>
        </DialogTrigger>
        <DialogContent className="left-0 top-0 h-full w-[290px] max-w-[85vw] translate-x-0 translate-y-0 rounded-none border-y-0 border-l-0 p-0">
          <DialogTitle className="border-b border-white/[0.07] p-5 text-sm">Navigate</DialogTitle>
          <nav className="space-y-1 p-3">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
                    active ? "bg-white/[0.06] text-foreground" : "text-muted-foreground",
                  )}
                >
                  <Icon className={cn("h-4 w-4", active && "text-signal-lime")} strokeWidth={1.8} />
                  <span className="flex-1">{item.label}</span>
                  {item.href === "/saved" && savedCount > 0 && <span className="font-mono text-[10px]">{savedCount}</span>}
                </Link>
              );
            })}
          </nav>
          <div className="absolute bottom-5 left-5 right-5 rounded-lg border border-white/[0.07] p-3 text-[11px] text-muted-foreground/60">
            Contacts and notes stay in this private workspace.
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
