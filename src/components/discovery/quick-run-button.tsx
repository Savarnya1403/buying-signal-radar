"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Radar } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DiscoveryResponse = {
  summary?: {
    totals: { fetched: number; signalsCreated: number; companiesCreated: number; prospectsScored: number };
    sources: { name: string; status: string; error?: string }[];
  };
  error?: { message: string };
};

export function QuickRunButton({
  sourceIds,
  label = "Run discovery",
  variant = "default",
  size = "default",
  className,
}: {
  sourceIds?: string[];
  label?: string;
  variant?: "default" | "secondary" | "outline";
  size?: "default" | "sm";
  className?: string;
}) {
  const [running, setRunning] = useState(false);
  const router = useRouter();

  async function run() {
    setRunning(true);
    const toastId = toast.loading("Scanning public sources…", {
      description: "Fetching feeds, respecting robots.txt and classifying evidence.",
    });
    try {
      const response = await fetch("/api/discovery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceIds }),
      });
      const data = (await response.json()) as DiscoveryResponse;
      if (!response.ok) throw new Error(data?.error?.message ?? "Discovery failed.");
      const totals = data.summary?.totals;
      const failures = data.summary?.sources.filter((source) => source.status === "FAILED") ?? [];
      toast.success(`Discovery complete`, {
        id: toastId,
        description: `${totals?.signalsCreated ?? 0} new signals · ${totals?.companiesCreated ?? 0} new companies · ${totals?.prospectsScored ?? 0} prospects scored.${failures.length ? ` ${failures.length} source(s) failed.` : ""}`,
      });
      router.refresh();
    } catch (error) {
      toast.error("Discovery failed", {
        id: toastId,
        description: error instanceof Error ? error.message : "Unknown error.",
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <Button variant={variant} size={size} onClick={run} disabled={running} className={cn(className)}>
      {running ? <Loader2 className="animate-spin" /> : <Radar />}
      {running ? "Scanning…" : label}
    </Button>
  );
}
