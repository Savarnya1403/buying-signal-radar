import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { RadarMark } from "@/components/brand/radar-mark";
import { PrintButton } from "@/components/reports/print-button";
import { prisma } from "@/lib/db";
import { formatDate, scoreTone } from "@/lib/utils";
import { SIGNAL_META } from "@/lib/signals";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type RankingSignal = {
  type: string;
  label: string;
  title: string;
  summary: string;
  sourceUrl: string;
  sourceName: string;
  publishedAt: string | null;
  discoveredAt: string;
  confidence: number;
};

type Ranking = {
  rank: number;
  company: string;
  website: string | null;
  industry: string;
  location: string;
  employeeCount: number | null;
  employeeRange: string | null;
  sizeSource: string | null;
  icpScore: number;
  signalScore: number;
  priorityScore: number;
  buyerRoleHypotheses: string[];
  signals: RankingSignal[];
};

type Snapshot = {
  generatedAt?: string;
  productCategory?: string;
  disclaimer?: string;
  icp?: {
    targetIndustries?: string[];
    geographies?: string[];
    companySizeMin?: number | null;
    companySizeMax?: number | null;
    buyerRoles?: string[];
    selectedSignalTypes?: string[];
  };
};

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const report = await prisma.report.findUnique({ where: { token }, select: { title: true } });
  return {
    title: report?.title ?? "Shared report",
    description: "A sanitised buying-signal report generated with Buying Signal Radar.",
    robots: { index: false, follow: false },
  };
}

export default async function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const report = await prisma.report.findUnique({ where: { token } });
  if (!report) notFound();

  const rankings = (report.rankings ?? []) as unknown as Ranking[];
  const snapshot = (report.payload ?? {}) as Snapshot;
  const breakdown = (report.signalBreakdown ?? {}) as Record<string, number>;
  const icp = snapshot.icp ?? {};

  return (
    <div className="min-h-screen bg-[#07090c]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(184,242,106,0.05),transparent_55%)]" />

      <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
        <header className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
          <Link href="/" className="flex items-center gap-2 text-signal-lime">
            <RadarMark size={26} />
            <span className="flex flex-col">
              <span className="text-[12px] font-semibold tracking-[0.16em] text-foreground">SIGNAL RADAR</span>
              <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-muted-foreground/60">Shared report</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <PrintButton />
          </div>
        </header>

        <main className="print-card mt-8">
          <section className="panel p-6 sm:p-8">
            <p className="label-mono print-muted">Buying-signal report · {formatDate(report.createdAt)}</p>
            <h1 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight text-foreground sm:text-[36px]">{report.title}</h1>
            <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-muted-foreground print-muted">
              {report.companyCount} ranked companies in {report.industry || "your target market"}, built from public signals and an explicit ICP. Scores are indices of fit and evidence — not probabilities of purchase.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Metric label="Companies" value={String(report.companyCount)} />
              <Metric label="Evidence window" value={`${formatDate(report.dateRangeStart, { day: "2-digit", month: "short" })} → ${formatDate(report.dateRangeEnd, { day: "2-digit", month: "short" })}`} />
            </div>

            {(icp.targetIndustries?.length || icp.geographies?.length || icp.buyerRoles?.length) && (
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <ChipGroup label="Target industries" values={icp.targetIndustries ?? []} />
                <ChipGroup label="Geographies" values={icp.geographies ?? []} />
                <ChipGroup label="Buyer roles" values={icp.buyerRoles ?? []} />
              </div>
            )}
          </section>

          {Object.keys(breakdown).length > 0 && (
            <section className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
              <div className="panel p-5">
                <p className="label-mono print-muted">Signal mix</p>
                <div className="mt-3 space-y-2">
                  {Object.entries(breakdown).sort((a, b) => b[1] - a[1]).map(([label, count]) => {
                    const max = Math.max(...Object.values(breakdown), 1);
                    return (
                      <div key={label}>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-muted-foreground/70 print-muted">{label}</span>
                          <span className="font-mono text-muted-foreground/50 print-muted">{count}</span>
                        </div>
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.07]">
                          <div className="h-full rounded-full bg-signal-lime/65" style={{ width: `${(count / max) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="panel p-5">
                <p className="label-mono print-muted">How to read this report</p>
                <div className="mt-3 space-y-2.5 text-[11px] leading-relaxed text-muted-foreground/70 print-muted">
                  <p><span className="font-medium text-foreground/85">ICP fit</span> measures how closely verified company attributes match the stated profile. Unknown values receive neutral credit and are labelled unverified.</p>
                  <p><span className="font-medium text-foreground/85">Signal score</span> combines signal category, evidence confidence, recency and diminishing returns for repeats. It is an intent index, not intent itself.</p>
                  <p><span className="font-medium text-foreground/85">Priority</span> is a weighted blend used to order the list. It is never a purchase probability.</p>
                  <p><span className="font-medium text-foreground/85">Buyer roles</span> are hypotheses derived from the ICP and public text, not confirmed contacts.</p>
                </div>
              </div>
            </section>
          )}

          <section className="mt-4 space-y-3">
            {rankings.map((ranking) => (
              <article key={`${ranking.rank}-${ranking.company}`} className="panel p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground/40">{String(ranking.rank).padStart(2, "0")}</span>
                      <h2 className="text-[16px] font-medium text-foreground">{ranking.company}</h2>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground/55 print-muted">
                      {ranking.industry} · {ranking.location}
                      {ranking.employeeCount ? ` · ${ranking.employeeCount.toLocaleString()} employees` : ranking.employeeRange ? ` · ${ranking.employeeRange} employees` : " · size unverified"}
                      {ranking.sizeSource ? ` (${ranking.sizeSource})` : ""}
                    </p>
                    {ranking.website && (
                      <a href={ranking.website} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-flex items-center gap-1 text-[10px] text-signal-lime/80 hover:underline">
                        {ranking.website.replace(/^https?:\/\//, "")} <ArrowUpRight className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <Score label="ICP fit" value={ranking.icpScore} />
                    <Score label="Signal" value={ranking.signalScore} />
                    <Score label="Priority" value={ranking.priorityScore} emphasis />
                  </div>
                </div>

                {ranking.buyerRoleHypotheses.length > 0 && (
                  <p className="mt-3 border-t border-white/[0.05] pt-2.5 text-[10px] text-muted-foreground/55 print-muted">
                    <span className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground/40">Buyer-role hypotheses: </span>
                    {ranking.buyerRoleHypotheses.join(" · ")}
                  </p>
                )}

                <div className="mt-3 space-y-2">
                  {ranking.signals.slice(0, 5).map((signal, index) => {
                    const meta = SIGNAL_META[signal.type as keyof typeof SIGNAL_META];
                    return (
                      <div key={`${signal.sourceUrl}-${index}`} className="rounded-lg border border-white/[0.05] bg-white/[0.012] px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-medium" style={{ borderColor: `${meta?.hex ?? "#94a3b8"}40`, backgroundColor: `${meta?.hex ?? "#94a3b8"}12`, color: meta?.hex ?? "#94a3b8" }}>
                            <span className="h-1 w-1 rounded-full" style={{ backgroundColor: meta?.hex ?? "#94a3b8" }} />
                            {signal.label}
                          </span>
                          <span className="text-[9px] text-muted-foreground/45 print-muted">{signal.sourceName}</span>
                          <span className="text-[9px] text-muted-foreground/35">·</span>
                          <span className="text-[9px] text-muted-foreground/45 print-muted">{formatDate(signal.publishedAt ?? signal.discoveredAt)}</span>
                          <span className="font-mono text-[8px] text-muted-foreground/35">{Math.round(signal.confidence * 100)}% conf.</span>
                        </div>
                        <p className="mt-1 text-[11px] font-medium leading-snug text-foreground/85">{signal.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground/55 print-muted">{signal.summary}</p>
                        <a href={signal.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-flex items-center gap-1 font-mono text-[8px] text-signal-lime/70 hover:underline">
                          source <ArrowUpRight className="h-2 w-2" />
                        </a>
                      </div>
                    );
                  })}
                  {ranking.signals.length === 0 && <p className="text-[10px] text-muted-foreground/45">No evidence signals recorded.</p>}
                </div>
              </article>
            ))}
          </section>

          <footer className="mt-6 rounded-lg border border-white/[0.06] bg-white/[0.015] p-4">
            <div className="flex items-start gap-2 text-[10px] leading-relaxed text-muted-foreground/50 print-muted">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signal-mint/60" />
              <div>
                <p className="font-medium text-foreground/75">Method &amp; disclaimer</p>
                <p className="mt-1">
                  {snapshot.disclaimer ??
                    "Scores are ICP-fit and buying-signal indices, not probabilities of purchase. Estimates and unverified fields are labelled. This report contains no contacts, notes or referral-graph data."}
                </p>
                <p className="mt-1.5 font-mono text-[8px] uppercase tracking-wider text-muted-foreground/35">
                  Generated {formatDate(report.createdAt)} · Buying Signal Radar · open-source GTM engineering
                </p>
              </div>
            </div>
          </footer>
        </main>

        <div className="no-print mt-6 flex items-center justify-between text-[10px] text-muted-foreground/35">
          <span>Sanitised link. No contacts, notes or graph data.</span>
          <Link href="/" className="transition-colors hover:text-signal-lime">Build your own radar →</Link>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.018] p-3">
      <p className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground/45 print-muted">{label}</p>
      <p className="mt-1 text-[15px] font-medium tabular-nums text-foreground/90">{value}</p>
    </div>
  );
}

function ChipGroup({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div className="rounded-lg border border-white/[0.055] bg-white/[0.015] p-3">
      <p className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground/40 print-muted">{label}</p>
      <p className="mt-1 text-[10px] leading-relaxed text-foreground/70">{values.join(" · ")}</p>
    </div>
  );
}

function Score({ label, value, emphasis = false }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <div className="text-right">
      <p className={cn("font-mono tabular-nums", emphasis ? "text-[20px]" : "text-[15px]", scoreTone(value))}>{value}</p>
      <p className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground/40 print-muted">{label}</p>
    </div>
  );
}
