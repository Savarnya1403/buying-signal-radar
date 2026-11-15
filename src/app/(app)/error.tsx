"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app]", error);
  }, [error]);

  return (
    <div className="panel flex min-h-[420px] flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-destructive/25 bg-destructive/10 text-[#ff9cac]">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <h1 className="mt-4 text-[19px] font-medium">This view could not load.</h1>
      <p className="mt-2 max-w-md text-[13px] leading-relaxed text-muted-foreground/65">
        The workspace database may still be starting, or a query failed. Your data is not lost. Retry the request, or return to the dashboard.
      </p>
      {error.digest && <p className="mt-2 font-mono text-[9px] text-muted-foreground/35">digest {error.digest}</p>}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button onClick={reset}><RefreshCw /> Retry</Button>
        <Button asChild variant="outline"><Link href="/dashboard">Dashboard</Link></Button>
      </div>
    </div>
  );
}
