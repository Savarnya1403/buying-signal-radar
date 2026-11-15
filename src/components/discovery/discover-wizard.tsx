"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Loader2,
  PencilLine,
  Plus,
  Radar,
  RefreshCw,
  Sparkles,
  Target,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScoreBar } from "@/components/shared/display";
import { ICP_SIGNAL_OPTIONS } from "@/lib/signals";
import { BUYER_ROLES, BUYING_TRIGGERS, GEOGRAPHIES, INDUSTRIES, PAIN_POINTS, SAMPLE_PRODUCT_DESCRIPTIONS } from "@/lib/icp/taxonomy";
import type { FieldRationale, IcpInterpretation } from "@/lib/icp/interpreter";
import { cn } from "@/lib/utils";

type InitialIcp = {
  id: string;
  productDescription: string;
  productCategory: string;
  targetIndustries: string[];
  companySizeMin: number | null;
  companySizeMax: number | null;
  geographies: string[];
  buyerRoles: string[];
  painPoints: string[];
  buyingTriggers: string[];
  exclusions: string[];
  selectedSignalTypes: string[];
  discoveryPeriodDays: number;
  confidence: number;
  rationale: unknown;
  isDemo: boolean;
};

type SourceSummary = {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  lastStatus: string | null;
};

type DiscoverySummary = {
  sources: {
    sourceId: string;
    name: string;
    type: string;
    status: string;
    fetched: number;
    kept: number;
    signalsCreated: number;
    duplicates: number;
    warnings: string[];
    error?: string;
  }[];
  totals: {
    fetched: number;
    kept: number;
    companiesCreated: number;
    signalsCreated: number;
    duplicates: number;
    prospectsScored: number;
  };
  warnings: string[];
};

const STEPS = [
  { id: 1, label: "Describe" },
  { id: 2, label: "Review ICP" },
  { id: 3, label: "Discover" },
];

function rationaleFields(value: unknown): FieldRationale[] {
  if (!value || typeof value !== "object") return [];
  const record = value as { fields?: unknown };
  return Array.isArray(record.fields) ? (record.fields as FieldRationale[]) : [];
}

function TagEditor({
  label,
  values,
  onChange,
  placeholder,
  suggestions,
  help,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  suggestions: string[];
  help?: string;
}) {
  const [draft, setDraft] = useState("");
  const available = suggestions.filter((suggestion) => !values.includes(suggestion)).slice(0, 7);

  function add(value: string) {
    const clean = value.trim().replace(/,$/, "");
    if (!clean || values.some((item) => item.toLowerCase() === clean.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...values, clean]);
    setDraft("");
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label>{label}</Label>
        {help && <span className="text-[9px] text-muted-foreground/45">{help}</span>}
      </div>
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-white/[0.09] bg-[#080b0f] p-1.5">
        {values.map((value) => (
          <span key={value} className="inline-flex items-center gap-1 rounded-md border border-white/[0.1] bg-white/[0.045] px-2 py-1 text-[11px] text-foreground/80">
            {value}
            <button type="button" onClick={() => onChange(values.filter((item) => item !== value))} className="text-muted-foreground/50 hover:text-[#fb7185]" aria-label={`Remove ${value}`}>
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              add(draft);
            }
            if (event.key === "Backspace" && !draft && values.length > 0) onChange(values.slice(0, -1));
          }}
          onBlur={() => draft && add(draft)}
          placeholder={values.length === 0 ? placeholder : "Add…"}
          className="h-6 min-w-[90px] flex-1 bg-transparent px-1 text-[11px] text-foreground outline-none placeholder:text-muted-foreground/40"
        />
      </div>
      {available.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {available.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => add(suggestion)}
              className="rounded border border-dashed border-white/[0.08] px-1.5 py-0.5 text-[9px] text-muted-foreground/50 transition-colors hover:border-signal-lime/25 hover:text-signal-lime/80"
            >
              + {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function DiscoverWizard({
  initialIcp,
  sources,
  demoSignals,
}: {
  initialIcp: InitialIcp | null;
  sources: SourceSummary[];
  demoSignals: number;
}) {
  const router = useRouter();
  const initialRationale = rationaleFields(initialIcp?.rationale);
  const [step, setStep] = useState<1 | 2 | 3>(initialIcp ? 2 : 1);
  const [description, setDescription] = useState(initialIcp?.productDescription ?? "");
  const [interpretation, setInterpretation] = useState<IcpInterpretation | null>(
    initialIcp
      ? {
          productCategory: initialIcp.productCategory,
          targetIndustries: initialIcp.targetIndustries,
          companySizeMin: initialIcp.companySizeMin,
          companySizeMax: initialIcp.companySizeMax,
          geographies: initialIcp.geographies,
          buyerRoles: initialIcp.buyerRoles,
          painPoints: initialIcp.painPoints,
          buyingTriggers: initialIcp.buyingTriggers,
          exclusions: initialIcp.exclusions,
          selectedSignalTypes: initialIcp.selectedSignalTypes,
          discoveryPeriodDays: initialIcp.discoveryPeriodDays,
          confidence: initialIcp.confidence,
          rationale: initialRationale,
          warnings: [],
        }
      : null,
  );
  const [interpretLoading, setInterpretLoading] = useState(false);
  const [interpretError, setInterpretError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DiscoverySummary | null>(null);
  const [selectedSources, setSelectedSources] = useState<string[]>(sources.filter((source) => source.enabled).map((source) => source.id));
  const [runStage, setRunStage] = useState(0);

  const enabledSources = useMemo(() => sources.filter((source) => source.enabled), [sources]);

  async function interpret() {
    setInterpretLoading(true);
    setInterpretError(null);
    try {
      const response = await fetch("/api/icp/interpret", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message ?? "Could not interpret that description.");
      setInterpretation(data.interpretation as IcpInterpretation);
      setStep(2);
    } catch (error) {
      setInterpretError(error instanceof Error ? error.message : "Could not interpret that description.");
    } finally {
      setInterpretLoading(false);
    }
  }

  async function confirmAndRun() {
    if (!interpretation) return;
    setSaving(true);
    setRunError(null);
    setRunning(true);
    setRunStage(1);
    try {
      const icpResponse = await fetch("/api/icp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productDescription: description,
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
      setSaving(false);
      setRunStage(2);

      const runResponse = await fetch("/api/discovery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          icpId: icpData.icp.id,
          periodDays: interpretation.discoveryPeriodDays,
          sourceIds: selectedSources.length > 0 ? selectedSources : undefined,
        }),
      });
      const runData = await runResponse.json();
      if (!runResponse.ok) throw new Error(runData?.error?.message ?? "Discovery failed.");
      setRunStage(3);
      setSummary(runData.summary as DiscoverySummary);
      setStep(3);
      toast.success("Discovery complete", {
        description: `${runData.summary.totals.signalsCreated} new signals across ${runData.summary.sources.length} sources.`,
      });
      router.refresh();
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Discovery failed.");
      toast.error("Could not complete discovery", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setRunning(false);
      setSaving(false);
    }
  }

  const update = <K extends keyof IcpInterpretation>(key: K, value: IcpInterpretation[K]) => {
    setInterpretation((current) => (current ? { ...current, [key]: value } : current));
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-2 rounded-lg border border-white/[0.06] bg-[#0a0e13] p-1.5">
        {STEPS.map((item, index) => {
          const active = step === item.id;
          const complete = step > item.id;
          return (
            <div key={item.id} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "flex flex-1 items-center gap-2 rounded-md px-3 py-1.5 text-[11px] transition-colors",
                  active ? "bg-white/[0.06] text-foreground" : complete ? "text-signal-lime/80" : "text-muted-foreground/45",
                )}
              >
                <span className={cn("flex h-4 w-4 items-center justify-center rounded-full border font-mono text-[8px]", active ? "border-signal-lime/40 bg-signal-lime/10 text-signal-lime" : complete ? "border-signal-lime/30 text-signal-lime" : "border-white/10")}>
                  {complete ? <Check className="h-2.5 w-2.5" /> : item.id}
                </span>
                {item.label}
              </div>
              {index < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/20" />}
            </div>
          );
        })}
        {initialIcp && (
          <button
            onClick={() => {
              setStep(1);
              setInterpretation(null);
              setDescription("");
              setSummary(null);
            }}
            className="ml-2 flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground/50 hover:text-foreground"
          >
            <RefreshCw className="h-3 w-3" /> Start over
          </button>
        )}
      </div>

      {step === 1 && (
        <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="panel p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="label-mono">Step 01 · Product description</p>
                <h2 className="mt-2 text-[20px] font-medium tracking-tight">What do you sell?</h2>
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                  Include who it is for, the pain it solves, and any size, industry or geography boundaries. Negations like “we don’t work with…” become exclusions.
                </p>
              </div>
              <Sparkles className="mt-1 h-4 w-4 shrink-0 text-signal-lime/60" />
            </div>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="We sell an AI revenue intelligence platform for B2B SaaS founders and sales teams. It helps them forecast pipeline, reduce CRM admin and spot at-risk deals. We focus on 20–500 employee companies in the US, UK and Germany. We don't work with enterprises over 5,000 employees."
              className="mt-5 min-h-[190px] resize-y text-[13px] leading-relaxed"
              maxLength={6000}
            />
            <div className="mt-2 flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground/45">Rules-based extraction. No external LLM required.</p>
              <p className="font-mono text-[9px] text-muted-foreground/40">{description.length}/6000</p>
            </div>
            {interpretError && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-[11px] text-[#ff9cac]">
                <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {interpretError}
              </div>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button onClick={interpret} disabled={interpretLoading || description.trim().length < 20} size="lg">
                {interpretLoading ? <Loader2 className="animate-spin" /> : <Target />}
                {interpretLoading ? "Reading your description…" : "Interpret & review ICP"}
                {!interpretLoading && <ArrowRight />}
              </Button>
              <Button asChild variant="ghost" size="lg"><Link href="/dashboard">Cancel</Link></Button>
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground/45">
              Nothing is scanned yet. You will review and edit every extracted field before discovery begins.
            </p>
          </div>

          <div className="space-y-3">
            <div className="panel p-4">
              <p className="label-mono">Try a sample</p>
              <div className="mt-3 space-y-2">
                {SAMPLE_PRODUCT_DESCRIPTIONS.map((sample) => (
                  <button
                    key={sample.label}
                    onClick={() => setDescription(sample.text)}
                    className="w-full rounded-lg border border-white/[0.06] bg-white/[0.018] p-3 text-left transition-colors hover:border-signal-lime/20 hover:bg-white/[0.03]"
                  >
                    <p className="text-[11px] font-medium text-foreground/80">{sample.label}</p>
                    <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground/55">{sample.text}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="panel p-4">
              <p className="label-mono">What gets extracted</p>
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {["Product category", "Target industries", "Company size", "Geography", "Buyer roles", "Pain points", "Buying triggers", "Exclusions"].map((item) => (
                  <div key={item} className="flex items-center gap-1.5 text-[10px] text-muted-foreground/65">
                    <CheckCircle2 className="h-3 w-3 text-signal-lime/50" /> {item}
                  </div>
                ))}
              </div>
            </div>
            {demoSignals > 0 && (
              <div className="rounded-lg border border-[#a78bfa]/20 bg-[#a78bfa]/[0.05] px-3 py-2.5 text-[10px] leading-relaxed text-[#c4b5fd]/70">
                Demo signals are currently loaded. Confirming a new ICP will re-rank the same synthetic companies against it. Reset demo data from Settings to remove them.
              </div>
            )}
          </div>
        </div>
      )}

      {step === 2 && interpretation && (
        <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="space-y-4">
            <div className="panel p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="label-mono">Step 02 · Confirm the ICP</p>
                  <h2 className="mt-2 text-[20px] font-medium tracking-tight">Edit anything that looks wrong.</h2>
                </div>
                <div className="rounded-lg border border-white/[0.07] px-3 py-2 text-right">
                  <p className="font-mono text-[16px] text-signal-lime">{Math.round(interpretation.confidence * 100)}%</p>
                  <p className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground/45">read confidence</p>
                </div>
              </div>

              <div className="mt-5 space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Product category</Label>
                    <Input value={interpretation.productCategory} onChange={(event) => update("productCategory", event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Company size (employees)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        placeholder="Min"
                        value={interpretation.companySizeMin ?? ""}
                        onChange={(event) => update("companySizeMin", event.target.value === "" ? null : Number(event.target.value))}
                      />
                      <span className="text-muted-foreground/40">–</span>
                      <Input
                        type="number"
                        min={1}
                        placeholder="Max"
                        value={interpretation.companySizeMax ?? ""}
                        onChange={(event) => update("companySizeMax", event.target.value === "" ? null : Number(event.target.value))}
                      />
                    </div>
                  </div>
                </div>

                <TagEditor
                  label="Target industries"
                  values={interpretation.targetIndustries}
                  onChange={(values) => update("targetIndustries", values)}
                  placeholder="e.g. B2B SaaS, Fintech"
                  suggestions={INDUSTRIES.map((item) => item.label)}
                  help="Required"
                />
                <TagEditor
                  label="Geographies"
                  values={interpretation.geographies}
                  onChange={(values) => update("geographies", values)}
                  placeholder="e.g. United States, United Kingdom"
                  suggestions={GEOGRAPHIES.map((item) => item.label)}
                />
                <TagEditor
                  label="Buyer roles"
                  values={interpretation.buyerRoles}
                  onChange={(values) => update("buyerRoles", values)}
                  placeholder="e.g. Founder / CEO, VP Sales"
                  suggestions={BUYER_ROLES.map((item) => item.label)}
                />
                <TagEditor
                  label="Pain points"
                  values={interpretation.painPoints}
                  onChange={(values) => update("painPoints", values)}
                  placeholder="e.g. Pipeline forecasting"
                  suggestions={PAIN_POINTS.map((item) => item.label)}
                />
                <TagEditor
                  label="Buying triggers"
                  values={interpretation.buyingTriggers}
                  onChange={(values) => update("buyingTriggers", values)}
                  placeholder="e.g. Hiring, Funding"
                  suggestions={BUYING_TRIGGERS.map((item) => item.label)}
                />
                <TagEditor
                  label="Exclusions"
                  values={interpretation.exclusions}
                  onChange={(values) => update("exclusions", values)}
                  placeholder="e.g. Enterprises over 5,000 employees"
                  suggestions={[]}
                  help="Caps ICP-fit at 35"
                />

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label>Signal categories</Label>
                    <button
                      type="button"
                      onClick={() =>
                        update(
                          "selectedSignalTypes",
                          interpretation.selectedSignalTypes.length === ICP_SIGNAL_OPTIONS.length
                            ? []
                            : ICP_SIGNAL_OPTIONS.map((option) => option.value),
                        )
                      }
                      className="text-[10px] text-muted-foreground/55 hover:text-foreground"
                    >
                      {interpretation.selectedSignalTypes.length === ICP_SIGNAL_OPTIONS.length ? "Clear all" : "Select all"}
                    </button>
                  </div>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {ICP_SIGNAL_OPTIONS.map((option) => {
                      const selected = interpretation.selectedSignalTypes.includes(option.value);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            update(
                              "selectedSignalTypes",
                              selected
                                ? interpretation.selectedSignalTypes.filter((item) => item !== option.value)
                                : [...interpretation.selectedSignalTypes, option.value],
                            )
                          }
                          className={cn(
                            "flex items-start gap-2 rounded-lg border p-2.5 text-left transition-colors",
                            selected ? "border-white/[0.13] bg-white/[0.04]" : "border-white/[0.055] bg-transparent opacity-60 hover:opacity-100",
                          )}
                        >
                          <span
                            className={cn("mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border", selected ? "border-transparent" : "border-white/20")}
                            style={selected ? { backgroundColor: option.hex } : undefined}
                          >
                            {selected && <Check className="h-2.5 w-2.5 text-[#07100a]" strokeWidth={3} />}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[11px] font-medium text-foreground/85">{option.label}</span>
                            <span className="mt-0.5 block text-[9px] leading-snug text-muted-foreground/50">{option.description}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {interpretation.selectedSignalTypes.length === 0 && (
                    <p className="text-[10px] text-[#ff9cac]">Select at least one signal category.</p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Discovery period</Label>
                    <Select
                      value={String(interpretation.discoveryPeriodDays)}
                      onValueChange={(value) => update("discoveryPeriodDays", Number(value))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">Last 7 days</SelectItem>
                        <SelectItem value="14">Last 14 days</SelectItem>
                        <SelectItem value="30">Last 30 days</SelectItem>
                        <SelectItem value="90">Last 90 days</SelectItem>
                        <SelectItem value="180">Last 180 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Sources for this run</Label>
                    <div className="rounded-lg border border-white/[0.08] bg-[#080b0f] px-3 py-2">
                      <p className="text-[11px] text-foreground/75">{selectedSources.length || enabledSources.length} of {enabledSources.length} enabled sources</p>
                      <p className="mt-0.5 text-[9px] text-muted-foreground/45">
                        {enabledSources.length === 0 ? "Default sources are created when you confirm." : "Manage connectors on Signal sources."}
                      </p>
                    </div>
                  </div>
                </div>

                {enabledSources.length > 0 && (
                  <div className="space-y-1.5">
                    {enabledSources.map((source) => {
                      const checked = selectedSources.includes(source.id);
                      return (
                        <label key={source.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-white/[0.055] px-3 py-2 text-[11px] transition-colors hover:bg-white/[0.02]">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) =>
                              setSelectedSources((current) =>
                                value ? [...current, source.id] : current.filter((id) => id !== source.id),
                              )
                            }
                          />
                          <span className="flex-1 text-foreground/75">{source.name}</span>
                          <span className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground/40">{source.type.replace("_", " ")}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {runError && (
                <div className="mt-5 flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-3 text-[11px] leading-relaxed text-[#ff9cac]">
                  <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <div>
                    <p className="font-medium">Discovery did not complete.</p>
                    <p className="mt-0.5 opacity-80">{runError}</p>
                    <Link href="/sources" className="mt-1 inline-block underline">Check your sources →</Link>
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-5">
                <Button onClick={confirmAndRun} disabled={running || interpretation.targetIndustries.length === 0 || interpretation.selectedSignalTypes.length === 0} size="lg">
                  {running ? <Loader2 className="animate-spin" /> : <Radar />}
                  {running ? (saving ? "Saving ICP…" : "Scanning public sources…") : "Confirm ICP & run discovery"}
                </Button>
                <Button variant="ghost" onClick={() => setStep(1)} disabled={running}>
                  <ArrowLeft /> Back
                </Button>
                {running && (
                  <div className="ml-auto hidden items-center gap-2 text-[10px] text-muted-foreground/60 sm:flex">
                    <span className={cn("h-1.5 w-1.5 rounded-full", runStage >= 1 ? "bg-signal-lime" : "bg-white/15")} />
                    save ICP
                    <span className={cn("h-1.5 w-1.5 rounded-full", runStage >= 2 ? "bg-signal-lime" : "bg-white/15")} />
                    fetch sources
                    <span className={cn("h-1.5 w-1.5 rounded-full", runStage >= 3 ? "bg-signal-lime" : "bg-white/15")} />
                    score
                  </div>
                )}
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground/40">
                Scores are indices, never probabilities. A run may take up to 45 seconds. Sources are fetched with timeouts and rate limits.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="panel p-4">
              <p className="label-mono">How we read it</p>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/50">
                Field-level confidence, with the sentence used. Nothing here is hidden from you.
              </p>
              <div className="mt-4 space-y-4">
                {interpretation.rationale.length === 0 && (
                  <p className="text-[11px] text-muted-foreground/50">This ICP was loaded from a saved profile or the demo dataset; no extraction rationale is attached.</p>
                )}
                {interpretation.rationale.map((field) => (
                  <div key={field.field}>
                    <ScoreBar label={field.label} score={Math.round(field.confidence * 100)} hint={field.note} />
                    {field.evidence.length > 0 && (
                      <div className="mt-1.5 space-y-1">
                        {field.evidence.slice(0, 2).map((evidence, index) => (
                          <p key={index} className="border-l border-white/[0.1] pl-2 text-[9px] italic leading-relaxed text-muted-foreground/45">
                            “{evidence.slice(0, 180)}”
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {interpretation.warnings.length > 0 && (
              <div className="rounded-lg border border-signal-amber/20 bg-signal-amber/[0.05] p-3">
                <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-signal-amber/80"><CircleAlert className="h-3 w-3" /> Before you run</p>
                <ul className="mt-2 space-y-1.5">
                  {interpretation.warnings.map((warning) => (
                    <li key={warning} className="text-[10px] leading-relaxed text-signal-amber/65">• {warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="panel p-4">
              <p className="label-mono">Exclusions are enforced</p>
              <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground/55">
                Companies matching an exclusion are not silently dropped. They are shown with ICP-fit capped at 35 and an explicit “excluded” component, so you can audit the decision.
              </p>
            </div>
          </div>
        </div>
      )}

      {step === 3 && summary && (
        <div className="mx-auto max-w-4xl space-y-4">
          <div className="panel relative overflow-hidden p-6 sm:p-8">
            <div className="absolute right-0 top-0 h-56 w-56 bg-[radial-gradient(circle_at_top_right,rgba(184,242,106,0.1),transparent_65%)]" />
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-signal-lime/30 bg-signal-lime/10 text-signal-lime"><CheckCircle2 className="h-4 w-4" /></span>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-signal-lime/70">Step 03 · Discovery complete</p>
                <h2 className="text-[20px] font-medium tracking-tight">{summary.totals.signalsCreated} new buying signals found.</h2>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Documents read", value: summary.totals.fetched },
                { label: "New companies", value: summary.totals.companiesCreated },
                { label: "New signals", value: summary.totals.signalsCreated },
                { label: "Prospects scored", value: summary.totals.prospectsScored },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
                  <p className="font-mono text-[22px] tabular-nums text-foreground">{item.value}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground/55">{item.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-2">
              {summary.sources.map((source) => (
                <div key={source.sourceId} className="flex items-start gap-2.5 rounded-lg border border-white/[0.055] px-3 py-2.5">
                  {source.status === "SUCCESS" ? (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signal-lime" />
                  ) : source.status === "FAILED" ? (
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#fb7185]" />
                  ) : (
                    <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signal-amber" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[11px] font-medium text-foreground/80">{source.name}</p>
                      <Badge variant={source.status === "SUCCESS" ? "primary" : source.status === "FAILED" ? "destructive" : "amber"} className="text-[9px]">{source.status}</Badge>
                      <span className="font-mono text-[9px] text-muted-foreground/40">{source.signalsCreated} signals · {source.fetched} read</span>
                    </div>
                    {source.error && <p className="mt-1 text-[10px] text-[#ff9cac]/70">{source.error}</p>}
                    {source.warnings.slice(0, 2).map((warning) => <p key={warning} className="mt-0.5 text-[9px] text-muted-foreground/45">{warning}</p>)}
                  </div>
                </div>
              ))}
            </div>
            {summary.warnings.length > 0 && (
              <div className="mt-3 rounded-lg border border-signal-amber/15 bg-signal-amber/[0.04] p-3 text-[10px] text-signal-amber/65">
                {summary.warnings.map((warning) => <p key={warning}>• {warning}</p>)}
              </div>
            )}
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild size="lg"><Link href="/companies">View ranked prospects <ArrowRight /></Link></Button>
              <Button asChild variant="outline" size="lg"><Link href="/dashboard">Open dashboard</Link></Button>
              <Button asChild variant="ghost" size="lg"><Link href="/discover">Edit ICP and rerun</Link></Button>
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground/40">
              Every signal links to its source and, when available, its publication date. Companies with no matching evidence are not invented.
            </p>
          </div>

          <div className="panel p-5">
            <p className="label-mono">What happens next</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {[
                { icon: <Radar className="h-3.5 w-3.5" />, title: "Inspect evidence", detail: "Open a company to see score components, quotes and source dates." },
                { icon: <Target className="h-3.5 w-3.5" />, title: "Tune scoring", detail: "Adjust ICP and signal weights without losing status or notes." },
                { icon: <Sparkles className="h-3.5 w-3.5" />, title: "Find a way in", detail: "Import contacts and let BFS find the shortest introduction path." },
              ].map((item) => (
                <div key={item.title} className="rounded-lg border border-white/[0.055] p-3">
                  <div className="text-signal-lime/70">{item.icon}</div>
                  <p className="mt-2 text-[11px] font-medium">{item.title}</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/50">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
