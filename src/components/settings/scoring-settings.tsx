"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Save, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { SIGNAL_META, SIGNAL_TYPES } from "@/lib/signals";
import { DEFAULT_SCORING_CONFIG, type ScoringConfig } from "@/lib/scoring/config";
import type { SignalType } from "@prisma/client";
import { cn } from "@/lib/utils";

const ICP_FIELDS: { key: keyof ScoringConfig["icpWeights"]; label: string; detail: string }[] = [
  { key: "industry", label: "Industry fit", detail: "Target industry overlap" },
  { key: "size", label: "Company size", detail: "Verified headcount vs range" },
  { key: "geography", label: "Geography", detail: "Location inside target markets" },
  { key: "buyerRole", label: "Buyer-role relevance", detail: "Public evidence of a buyer role" },
  { key: "triggerAlignment", label: "Trigger & pain relevance", detail: "Signals matched to your triggers" },
];

export function ScoringSettings({ initial, rescoredHint }: { initial: ScoringConfig; rescoredHint?: number }) {
  const router = useRouter();
  const [config, setConfig] = useState<ScoringConfig>(initial);
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();
  const [dirty, setDirty] = useState(false);

  const icpTotal = useMemo(
    () => Object.values(config.icpWeights).reduce((sum, value) => sum + value, 0),
    [config.icpWeights],
  );

  const update = <K extends keyof ScoringConfig>(key: K, value: ScoringConfig[K]) => {
    setConfig((current) => ({ ...current, [key]: value }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/scoring", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(config),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message ?? "Could not save scoring weights.");
      toast.success(`Scoring saved. ${body.rescored ?? 0} prospect${body.rescored === 1 ? "" : "s"} re-scored.`);
      setDirty(false);
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-3.5 w-3.5 text-signal-lime" />
              <p className="label-mono">ICP-fit weights</p>
            </div>
            <p className="mt-1 max-w-lg text-[11px] leading-relaxed text-muted-foreground/60">
              These weights are normalised to 100 when scoring, so only their relative size matters. Unknown company attributes always receive neutral partial credit and are labelled unverified.
            </p>
          </div>
          <Badge variant="outline" className="font-mono text-[9px]">TOTAL {icpTotal}</Badge>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {ICP_FIELDS.map((field) => (
            <div key={field.key} className="rounded-lg border border-white/[0.055] p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-medium text-foreground/85">{field.label}</p>
                  <p className="mt-0.5 text-[9px] text-muted-foreground/45">{field.detail}</p>
                </div>
                <span className="font-mono text-[11px] text-signal-lime">{config.icpWeights[field.key]}</span>
              </div>
              <Slider
                className="mt-2.5"
                value={[config.icpWeights[field.key]]}
                min={0}
                max={50}
                step={1}
                onValueChange={([value]) => update("icpWeights", { ...config.icpWeights, [field.key]: value })}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="label-mono">Signal-category weights</p>
            <p className="mt-1 max-w-lg text-[11px] leading-relaxed text-muted-foreground/60">
              Base contribution of each signal before confidence, recency decay and diminishing returns for repeated categories.
            </p>
          </div>
          <Badge variant="outline" className="font-mono text-[9px]">{SIGNAL_TYPES.length} CATEGORIES</Badge>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SIGNAL_TYPES.map((type) => (
            <div key={type} className="rounded-lg border border-white/[0.055] p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[10px] text-foreground/80">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: SIGNAL_META[type].hex }} />
                  {SIGNAL_META[type].label}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground/60">{config.signalWeights[type]}</span>
              </div>
              <Slider
                className="mt-2"
                value={[config.signalWeights[type]]}
                min={0}
                max={30}
                step={1}
                onValueChange={([value]) => update("signalWeights", { ...config.signalWeights, [type]: value } as Record<SignalType, number>)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-5">
          <p className="label-mono">Priority blend</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/60">
            How much ICP fit versus live signal evidence contributes to the ordering. Both are normalised together.
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground/70">ICP-fit contribution</span>
                <span className="font-mono text-signal-lime">{config.priorityIcpWeight}</span>
              </div>
              <Slider
                className="mt-2"
                value={[config.priorityIcpWeight]}
                min={0}
                max={100}
                step={5}
                onValueChange={([value]) => update("priorityIcpWeight", value)}
              />
            </div>
            <div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground/70">Signal contribution</span>
                <span className="font-mono text-signal-mint">{config.prioritySignalWeight}</span>
              </div>
              <Slider
                className="mt-2"
                value={[config.prioritySignalWeight]}
                min={0}
                max={100}
                step={5}
                onValueChange={([value]) => update("prioritySignalWeight", value)}
              />
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.018] px-3 py-2 font-mono text-[9px] leading-relaxed text-muted-foreground/50">
            priority = round((icp × {config.priorityIcpWeight} + signal × {config.prioritySignalWeight}) / {config.priorityIcpWeight + config.prioritySignalWeight || 1})
          </div>
          <p className="mt-2 text-[9px] leading-relaxed text-muted-foreground/40">
            Priority is an ordering index. It is never described as a probability of purchase.
          </p>
        </div>

        <div className="panel p-5">
          <p className="label-mono">Recency decay</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/60">
            A signal&apos;s contribution halves every {config.recencyHalfLifeDays} days. Older evidence still counts, but less.
          </p>
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground/70">Half-life</span>
              <span className="font-mono text-signal-amber">{config.recencyHalfLifeDays} days</span>
            </div>
            <Slider
              className="mt-2"
              value={[config.recencyHalfLifeDays]}
              min={1}
              max={90}
              step={1}
              onValueChange={([value]) => update("recencyHalfLifeDays", value)}
            />
            <div className="mt-3 flex justify-between font-mono text-[8px] uppercase tracking-wider text-muted-foreground/30">
              <span>1d — fast decay</span>
              <span>90d — long memory</span>
            </div>
          </div>
          <div className="mt-4 space-y-1.5 border-t border-white/[0.05] pt-3 text-[10px] leading-relaxed text-muted-foreground/50">
            <p className="flex justify-between"><span>7 days old</span><span className="font-mono">{Math.round(Math.pow(0.5, 7 / Math.max(1, config.recencyHalfLifeDays)) * 100)}%</span></p>
            <p className="flex justify-between"><span>30 days old</span><span className="font-mono">{Math.round(Math.pow(0.5, 30 / Math.max(1, config.recencyHalfLifeDays)) * 100)}%</span></p>
            <p className="flex justify-between"><span>90 days old</span><span className="font-mono">{Math.round(Math.pow(0.5, 90 / Math.max(1, config.recencyHalfLifeDays)) * 100)}%</span></p>
          </div>
        </div>
      </div>

      <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-[11px] text-muted-foreground/60">
            {dirty ? "Unsaved changes — saving re-scores every prospect for the current ICP." : rescoredHint != null ? `${rescoredHint} prospects were scored last time these weights were saved.` : "Scores recompute automatically after saving."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setConfig(DEFAULT_SCORING_CONFIG);
              setDirty(true);
              toast.message("Defaults restored in the form. Save to apply.");
            }}
            disabled={saving}
          >
            <RotateCcw /> Reset defaults
          </Button>
          <Button size="sm" onClick={save} disabled={saving || pending || !dirty} className={cn(!dirty && "opacity-50")}>
            {saving || pending ? <Loader2 className="animate-spin" /> : <Save />} Save &amp; re-score
          </Button>
        </div>
      </div>
    </div>
  );
}
