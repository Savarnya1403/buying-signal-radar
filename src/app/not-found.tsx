import Link from "next/link";
import { Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadarMark } from "@/components/brand/radar-mark";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] text-signal-lime">
          <RadarMark size={28} />
        </div>
        <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">404 · no signal</p>
        <h1 className="mt-2 text-[26px] font-semibold tracking-tight">This route isn&apos;t on the radar.</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground/65">
          The page may have been moved, the report link revoked, or the company removed from this workspace.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button asChild><Link href="/dashboard"><Radar /> Dashboard</Link></Button>
          <Button asChild variant="outline"><Link href="/discover">Discover</Link></Button>
        </div>
      </div>
    </div>
  );
}
