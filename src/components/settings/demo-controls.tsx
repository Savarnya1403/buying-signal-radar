"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function DemoControls({ seeded }: { seeded: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"reseed" | "reset" | null>(null);
  const [pending, startTransition] = useTransition();

  const run = async (action: "reseed" | "reset") => {
    if (action === "reset" && !window.confirm("Remove all demo companies, signals, contacts and demo reports? Live data and your ICP stay untouched.")) return;
    setBusy(action);
    try {
      const response = await fetch("/api/demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message ?? "Demo action failed.");
      toast.success(action === "reseed" ? "Demo dataset refreshed." : "Demo data removed.");
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => run("reseed")} disabled={Boolean(busy) || pending}>
        {busy === "reseed" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        {seeded ? "Refresh demo data" : "Load demo data"}
      </Button>
      {seeded && (
        <Button variant="ghost" size="sm" onClick={() => run("reset")} disabled={Boolean(busy) || pending} className="text-[#ff9cac]/80 hover:text-[#ff9cac]">
          {busy === "reset" ? <Loader2 className="animate-spin" /> : <Trash2 />} Remove demo data
        </Button>
      )}
    </div>
  );
}
