"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Radar, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { IcpInterpretation } from "@/lib/icp/interpreter";

const STAGES = ["Reading your description", "Saving the ICP", "Scanning sources", "Scoring prospects"];

export function QuickScan({ sample }: { sample: string }) {
  const [description, setDescription] = useState("");
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function findLeads() {
    const text = description.trim();
    if (text.length < 20) {
      setError("Describe your product in at least 20 characters.");
      return;
    }

    setRunning(true);
    setError(null);
    setStage(0);
    const toastId = toast.loading("Finding companies that match your business…", {
      description: "Reading your description, then scanning permitted public sources.",
    });

    try {
      const interpretResponse = await fetch("/api/icp/interpret", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description: text }),
      });
      const interpretData = await interpretResponse.json();
      if (!interpretResponse.ok) {
        throw new Error(interpretData?.error?.message ?? "Could not read that description.");
      }
      const interpretation = interpretData.interpretation as IcpInterpretation;
      setStage(1);

      const icpResponse = await fetch("/api/icp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productDescription: text,
          productCategory: interpretation.productCategory,
          targetIndustries: interpretation.targetIndustries,
          companySizeMin: interpretation.companySizeMin,
          companySizeMax: interpretation.companySizeMax,
          geographies: interpretation.geographies,
          buyerRoles: interpretation.buyerRoles,
          painPoints: interpretation.painPoints,
          buyingTriggers: interpretation.buyingTriggers,
          exclusions: interpretation.exclusions,
          selectedSignalTypes: interpretation.selectedSignalTypes,
          discoveryPeriodDays: interpretation.discoveryPeriodDays,
          confidence: interpretation.confidence,
          rationale: { fields: interpretation.rationale, warnings: interpretation.warnings },
        }),
      });
      const icpData = await icpResponse.json();
      if (!icpResponse.ok) throw new Error(icpData?.error?.message ?? "Could not save the ICP.");
      setStage(2);

      const runResponse = await fetch("/api/discovery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          icpId: icpData.icp.id,
          periodDays: interpretation.discoveryPeriodDays,
        }),
      });
      const runData = await runResponse.json();
      if (!runResponse.ok) throw new Error(runData?.error?.message ?? "Discovery failed.");
      setStage(3);

      toast.success("Leads are ready", {
        id: toastId,
        description: `${runData.summary.totals.prospectsScored} companies scored from ${runData.summary.totals.signalsCreated} new signals.`,
      });
      router.refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not complete the scan.";
      setError(message);
      toast.error("Could not finish the scan", { id: toastId, description: message });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="rounded-xl border border-white/[0.08] bg-[#080b0f] p-3">
        <Textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={sample}
          rows={4}
          disabled={running}
          className="min-h-[96px] resize-none border-0 bg-transparent p-2 text-[13px] leading-relaxed focus-visible:ring-0"
          aria-label="Describe what you sell and who you want to reach"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.05] px-1 pt-3">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/45">
            No forms · ICP is saved and editable
          </p>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" disabled={running}>
              <Link href="/discover">
                Review ICP first
              </Link>
            </Button>
            <Button onClick={findLeads} disabled={running || description.trim().length < 20} size="sm">
              {running ? <Loader2 className="animate-spin" /> : <Radar />}
              {running ? "Finding leads…" : "Find leads now"}
            </Button>
          </div>
        </div>
      </div>

      {running && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 px-1">
          {STAGES.map((label, index) => (
            <span
              key={label}
              className={
                index <= stage
                  ? "flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-signal-lime/80"
                  : "flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/35"
              }
            >
              <span className={index <= stage ? "h-1 w-1 rounded-full bg-signal-lime" : "h-1 w-1 rounded-full bg-white/15"} />
              {label}
            </span>
          ))}
        </div>
      )}

      {error && (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-signal-rose">
          <Sparkles className="h-3 w-3" />
          {error}
        </p>
      )}

      <p className="mt-3 px-1 text-[11px] leading-relaxed text-muted-foreground/55">
        We infer industry, size, geography, buyer roles and buying triggers from your words, then show every
        company with its evidence. You can adjust any field afterwards — no repeated form filling.
        <Link href="/discover" className="ml-1 inline-flex items-center gap-0.5 text-signal-lime/80 hover:text-signal-lime">
          Open the full editor <ArrowRight className="h-3 w-3" />
        </Link>
      </p>
    </div>
  );
}
