"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bookmark, Check, Copy, ExternalLink, Loader2, MoreHorizontal, Send, ShieldX, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ProspectStatus = "NEW" | "SAVED" | "CONTACTED" | "DISQUALIFIED";

export function ProspectQuickActions({
  prospectId,
  companyId,
  status,
  sourceLinks = [],
  introRequest,
  compact = false,
}: {
  prospectId: string;
  companyId: string;
  status: string;
  sourceLinks?: string[];
  introRequest?: string | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState<ProspectStatus | null>(null);

  const setStatus = async (next: ProspectStatus) => {
    setSaving(next);
    try {
      const response = await fetch(`/api/prospects/${prospectId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Could not update the prospect.");
      }
      toast.success(
        next === "SAVED" ? "Saved to your action centre." :
        next === "CONTACTED" ? "Marked as contacted." :
        next === "DISQUALIFIED" ? "Disqualified. Re-ranking remaining prospects." :
        "Moved back to new.",
      );
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setSaving(null);
    }
  };

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(label);
    } catch {
      toast.error("Clipboard access was blocked by the browser.");
    }
  };

  const busy = pending || Boolean(saving);

  return (
    <div className={compact ? "" : "flex flex-wrap items-center gap-2"} onClick={(event) => event.stopPropagation()}>
      {!compact && (
        <>
          <Button
            size="sm"
            variant={status === "SAVED" ? "default" : "outline"}
            disabled={busy || status === "SAVED"}
            onClick={() => setStatus("SAVED")}
          >
            {saving === "SAVED" ? <Loader2 className="animate-spin" /> : status === "SAVED" ? <Check /> : <Bookmark />}
            {status === "SAVED" ? "Saved" : "Save"}
          </Button>
          <Button size="sm" variant="outline" disabled={busy || status === "CONTACTED"} onClick={() => setStatus("CONTACTED")}>
            {saving === "CONTACTED" ? <Loader2 className="animate-spin" /> : <Send />} Contacted
          </Button>
        </>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant={compact ? "ghost" : "outline"} className={compact ? "h-7 w-7 p-0" : ""} aria-label="Prospect actions" disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoreHorizontal className="h-3.5 w-3.5" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[220px]">
          <DropdownMenuLabel>Prospect actions</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link href={`/companies/${companyId}`}><ExternalLink className="mr-2 h-3.5 w-3.5" /> Open full evidence</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={status === "SAVED"} onSelect={() => setStatus("SAVED")}>
            <Bookmark className="mr-2 h-3.5 w-3.5" /> Save for follow-up
          </DropdownMenuItem>
          <DropdownMenuItem disabled={status === "CONTACTED"} onSelect={() => setStatus("CONTACTED")}>
            <Send className="mr-2 h-3.5 w-3.5" /> Mark contacted
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => copy(sourceLinks.join("\n"), "Source links copied.")}>
            <Copy className="mr-2 h-3.5 w-3.5" /> Copy source links
          </DropdownMenuItem>
          {introRequest && (
            <DropdownMenuItem onSelect={() => copy(introRequest, "Intro request copied.")}>
              <Copy className="mr-2 h-3.5 w-3.5" /> Copy intro request
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {status === "DISQUALIFIED" ? (
            <DropdownMenuItem onSelect={() => setStatus("NEW")}>
              <Undo2 className="mr-2 h-3.5 w-3.5" /> Restore prospect
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem className="text-[#ff9cac] focus:text-[#ff9cac]" onSelect={() => setStatus("DISQUALIFIED")}>
              <ShieldX className="mr-2 h-3.5 w-3.5" /> Disqualify
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
