import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Building2,
  CircleDot,
  Network,
  Radar,
  Rss,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CompanyAvatar,
  MetricCard,
  ScoreBar,
  SignalBadge,
} from "@/components/shared/display";
import { SignalRadar, type RadarSignal } from "@/components/dashboard/signal-radar";
import { SignalVolumeChart, type VolumePoint } from "@/components/dashboard/charts";
import { QuickRunButton } from "@/components/discovery/quick-run-button";
import { QuickScan } from "@/components/discovery/quick-scan";
import { ensureWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import { signalMeta } from "@/lib/signals";
import { relativeTime, scoreTone, truncate } from "@/lib/utils";
import { SAMPLE_PRODUCT_DESCRIPTIONS } from "@/lib/icp/taxonomy";

export const dynamic = "force-dynamic";

function daysAgo(date: Date) {
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
}

export default async function DashboardPage() {
  const workspace = await ensureWorkspace();
  const icp = await prisma.icpProfile.findFirst({
    where: { workspaceId: workspace.id, isConfirmed: true },
    orderBy: { createdAt: "desc" },
  });

  if (!icp) return <NoIcpDashboard />;

  const [prospects, prospectsCount, highPriority, signals7d, sources, contacts, totalSignals, recentSignals] =
    await Promise.all([
      prisma.prospect.findMany({
        where: { workspaceId: workspace.id, icpProfileId: icp.id, status: { not: "DISQUALIFIED" } },
        include: {
          company: {
            include: { signals: { orderBy: [{ publishedAt: "desc" }, { discoveredAt: "desc" }], take: 4 } },
          },
        },
        orderBy: { priorityScore: "desc" },
        take: 6,
      }),
      prisma.prospect.count({ where: { workspaceId: workspace.id, icpProfileId: icp.id, status: { not: "DISQUALIFIED" } } }),
      prisma.prospect.count({
        where: { workspaceId: workspace.id, icpProfileId: icp.id, status: { not: "DISQUALIFIED" }, priorityScore: { gte: 70 } },
      }),
      prisma.signal.count({
        where: { workspaceId: workspace.id, discoveredAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
      }),
      prisma.source.findMany({
        where: { workspaceId: workspace.id, enabled: true },
        select: { id: true, name: true, lastStatus: true, lastRunAt: true },
      }),
      prisma.contact.count({ where: { workspaceId: workspace.id } }),
      prisma.signal.count({ where: { workspaceId: workspace.id } }),
      prisma.signal.findMany({
        where: { workspaceId: workspace.id },
        include: { company: { select: { id: true, name: true } } },
        orderBy: [{ publishedAt: "desc" }, { discoveredAt: "desc" }],
        take: 80,
      }),
    ]);

  const healthySources = sources.filter((source) => source.lastStatus !== "FAILED").length;

  const radarSignals: RadarSignal[] = recentSignals.slice(0, 32).map((signal) => ({
    id: signal.id,
    type: signal.type,
    company: signal.company.name,
    companyId: signal.company.id,
    title: signal.title,
    daysAgo: daysAgo(signal.publishedAt ?? signal.discoveredAt),
    confidence: signal.confidence,
  }));

  const volume: VolumePoint[] = Array.from({ length: 14 }).map((_, index) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (13 - index));
    const end = new Date(start.getTime() + 86_400_000);
    const inDay = recentSignals.filter((signal) => {
      const date = signal.publishedAt ?? signal.discoveredAt;
      return date >= start && date < end;
    });
    return {
      day: start.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      live: inDay.length,
    };
  });

  const signalMix = new Map<string, number>();
  for (const signal of recentSignals) signalMix.set(signal.type, (signalMix.get(signal.type) ?? 0) + 1);
  const mix = [...signalMix.entries()].sort((a, b) => b[1] - a[1]);
  const strongest = [...recentSignals].sort((a, b) => b.confidence - a.confidence)[0];

  return (
    <div>
      <PageHeader
        eyebrow="Command centre"
        title={
          <>
            Signal intelligence for <span className="text-gradient">{icp.productCategory.toLowerCase()}</span>.
          </>
        }
        description={
          <span>
            {icp.targetIndustries.slice(0, 3).join(" · ")}
            {icp.geographies.length > 0 && ` · ${icp.geographies.slice(0, 3).join(", ")}`}
            {icp.companySizeMin && icp.companySizeMax && ` · ${icp.companySizeMin}–${icp.companySizeMax} employees`}
          </span>
        }
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/discover"><Target /> Edit ICP</Link>
            </Button>
            <QuickRunButton size="sm" />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Ranked prospects"
          value={prospectsCount}
          detail={`${highPriority} high-priority · evidence-backed`}
          icon={<Building2 className="h-4 w-4" />}
          href="/companies"
        />
        <MetricCard
          label="High priority"
          value={highPriority}
          detail="Priority score ≥ 70 — an index, not a probability"
          icon={<Target className="h-4 w-4" />}
          tone="lime"
          href="/companies?sort=priority"
        />
        <MetricCard
          label="Signals · 7 days"
          value={signals7d}
          detail={`${totalSignals} total signals in workspace`}
          icon={<TrendingUp className="h-4 w-4" />}
          tone="violet"
          href="/sources"
        />
        <MetricCard
          label="Sources"
          value={sources.length > 0 ? `${healthySources}/${sources.length}` : "None"}
          detail={sources.length > 0 ? "Enabled connectors responding" : "Add a source to run live scans"}
          icon={<Rss className="h-4 w-4" />}
          href="/sources"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <SignalRadar signals={radarSignals} />

        <div className="panel flex flex-col">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <div>
              <p className="label-mono">Latest evidence</p>
              <p className="mt-1 text-[12px] text-muted-foreground/70">Public, traceable buying signals</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="h-7 text-[11px]">
              <Link href="/sources">Sources <ArrowRight className="h-3 w-3" /></Link>
            </Button>
          </div>
          <div className="divide-y divide-white/[0.045]">
            {recentSignals.slice(0, 6).map((signal) => {
              const meta = signalMeta(signal.type);
              return (
                <Link
                  key={signal.id}
                  href={`/companies/${signal.company.id}`}
                  className="group flex gap-3 px-5 py-3 transition-colors hover:bg-white/[0.025]"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: meta.hex }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[12px] font-medium text-foreground/90">{signal.company.name}</p>
                      <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/45">{meta.shortLabel}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground/65">
                      {truncate(signal.title, 120)}
                    </p>
                    <p className="mt-1 font-mono text-[9px] text-muted-foreground/40">
                      {signal.sourceName} · {relativeTime(signal.publishedAt ?? signal.discoveredAt)}
                    </p>
                  </div>
                  <ArrowUpRight className="mt-2 h-3 w-3 shrink-0 text-muted-foreground/25 transition-colors group-hover:text-signal-lime" />
                </Link>
              );
            })}
            {recentSignals.length === 0 && (
              <div className="px-5 py-10 text-center text-[12px] text-muted-foreground/60">
                No signals yet. Add a source and run discovery.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="panel">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <div>
              <p className="label-mono">Top prospects</p>
              <p className="mt-1 text-[12px] text-muted-foreground/70">Ranked by combined priority — with separate fit and intent scores</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="h-7 text-[11px]">
              <Link href="/companies">View all <ArrowRight className="h-3 w-3" /></Link>
            </Button>
          </div>
          <div className="divide-y divide-white/[0.045]">
            {prospects.map((prospect, index) => (
              <Link
                key={prospect.id}
                href={`/companies/${prospect.company.id}`}
                className="group grid grid-cols-[auto_1fr_auto] items-center gap-3 px-5 py-3.5 transition-colors hover:bg-white/[0.025]"
              >
                <div className="flex items-center gap-3">
                  <span className="w-4 font-mono text-[10px] text-muted-foreground/35">{String(index + 1).padStart(2, "0")}</span>
                  <CompanyAvatar name={prospect.company.name} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-[13px] font-medium text-foreground">{prospect.company.name}</p>
                    {prospect.company.industry && <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/45">{prospect.company.industry}</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {prospect.company.signals.slice(0, 3).map((signal) => (
                      <SignalBadge key={signal.id} type={signal.type} compact />
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className="hidden w-[74px] sm:block">
                    <ScoreBar label="ICP" score={prospect.icpScore} />
                  </div>
                  <div className="hidden w-[74px] md:block">
                    <ScoreBar label="Signal" score={prospect.signalScore} />
                  </div>
                  <div className="w-11 text-right">
                    <p className={`font-mono text-[18px] tabular-nums ${scoreTone(prospect.priorityScore)}`}>{prospect.priorityScore}</p>
                    <p className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground/40">priority</p>
                  </div>
                </div>
              </Link>
            ))}
            {prospects.length === 0 && (
              <div className="px-5 py-12 text-center">
                <p className="text-[13px] text-muted-foreground">No prospects ranked yet.</p>
                <div className="mt-3 flex justify-center gap-2">
                  <Button asChild size="sm"><Link href="/discover">Run discovery</Link></Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="panel p-5">
            <div className="flex items-center justify-between">
              <p className="label-mono">Signal mix</p>
              <span className="font-mono text-[9px] text-muted-foreground/40">LAST 80</span>
            </div>
            <div className="mt-4 space-y-2.5">
              {mix.slice(0, 5).map(([type, count]) => {
                const meta = signalMeta(type);
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1.5 text-muted-foreground/75">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.hex }} />
                        {meta.label}
                      </span>
                      <span className="font-mono text-muted-foreground/50">{count}</span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.05]">
                      <div className="h-full rounded-full" style={{ width: `${(count / Math.max(1, mix[0]?.[1] ?? 1)) * 100}%`, backgroundColor: meta.hex, opacity: 0.75 }} />
                    </div>
                  </div>
                );
              })}
              {mix.length === 0 && <p className="text-[11px] text-muted-foreground/50">No signal breakdown yet.</p>}
            </div>
            {strongest && (
              <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/45">Strongest evidence</p>
                <p className="mt-1 text-[11px] leading-snug text-foreground/80">{truncate(strongest.title, 100)}</p>
                <p className="mt-1 text-[10px] text-muted-foreground/50">
                  {Math.round(strongest.confidence * 100)}% confidence · {strongest.sourceName}
                </p>
              </div>
            )}
          </div>

          <div className="panel p-5">
            <p className="label-mono">Signal volume · 14d</p>
            <div className="mt-2">
              <SignalVolumeChart data={volume} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="panel flex items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-signal-mint/20 bg-signal-mint/[0.06] text-signal-mint">
              <Network className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[13px] font-medium">Warm introduction paths</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/65">
                {contacts > 0
                  ? `${contacts} contacts mapped. Find the shortest route into a prospect using only relationships you provided.`
                  : "Import your contacts to discover the shortest introduction route into a prospect."}
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="outline"><Link href="/referral">Open graph <ArrowRight /></Link></Button>
        </div>
        <div className="panel flex items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#a78bfa]/20 bg-[#a78bfa]/[0.06] text-[#c4b5fd]">
              <Bookmark className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[13px] font-medium">Action centre</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/65">
                Save, contact or disqualify prospects. Export evidence and copy source links — no heavy CRM.
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="outline"><Link href="/saved">Review <ArrowRight /></Link></Button>
        </div>
      </div>
    </div>
  );
}

function NoIcpDashboard() {
  return (
    <div>
      <PageHeader
        eyebrow="Buying Signal Radar"
        title={<>Tell us what you sell. We&apos;ll find who might need it — <span className="text-gradient">and why now.</span></>}
        description="Describe your product in plain English. We extract an editable ICP, scan permitted public sources for buying signals, rank companies and map warm introduction paths. No fabricated data."
      />

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="panel relative overflow-hidden p-6 sm:p-8">
          <div className="absolute right-0 top-0 h-64 w-64 bg-[radial-gradient(circle_at_top_right,rgba(184,242,106,0.09),transparent_65%)]" />
          <p className="label-mono">Start here · 60 seconds</p>
          <h2 className="mt-3 max-w-lg text-[22px] font-medium leading-tight tracking-tight">
            What do you sell, who is it for, and what makes a company ready to buy?
          </h2>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
            Describe your product once. We infer the ICP, save it, scan the right market and rank companies — no repeated form filling.
          </p>
          <QuickScan sample={SAMPLE_PRODUCT_DESCRIPTIONS[0].text} />
          <div className="mt-6 space-y-3">
            {[
              { step: "01", title: "Describe your product", detail: "Plain English. No forms, no firmographic guessing." },
              { step: "02", title: "Review only if you want", detail: "The ICP is saved automatically and every field stays editable." },
              { step: "03", title: "Scan the right market", detail: "India, the US or Europe — sources follow the geography you name." },
              { step: "04", title: "Rank, verify, introduce", detail: "Separate fit and intent scores, traceable evidence, referral paths." },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3 rounded-lg border border-white/[0.055] bg-white/[0.018] p-3">
                <span className="font-mono text-[10px] text-signal-lime/70">{item.step}</span>
                <div>
                  <p className="text-[12px] font-medium text-foreground/85">{item.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/60">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Button asChild size="lg"><Link href="/discover"><Sparkles /> Describe your product</Link></Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="panel relative overflow-hidden p-5">
            <div className="flex items-center justify-between">
              <p className="label-mono">Example input</p>
              <Badge variant="outline" className="font-mono text-[9px]">PLAIN ENGLISH</Badge>
            </div>
            <div className="relative mt-4 rounded-lg border border-white/[0.08] bg-[#080b0f] p-4">
              <p className="text-[12px] leading-relaxed text-foreground/75">
                “{SAMPLE_PRODUCT_DESCRIPTIONS[0].text}”
              </p>
              <div className="mt-3 flex items-center gap-2 border-t border-white/[0.05] pt-3">
                <CircleDot className="h-3 w-3 text-signal-lime" />
                <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/50">Will extract 8 ICP fields + evidence</span>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {["Revenue intelligence", "B2B SaaS · Fintech", "20–500 employees", "US · UK · Germany", "Founders · VP Sales", "Forecasting · CRM admin", "5 buying triggers", "1 exclusion"].map((chip) => (
                <span key={chip} className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[10px] text-muted-foreground/65">
                  {chip}
                </span>
              ))}
            </div>
          </div>

          <div className="panel overflow-hidden">
            <div className="relative flex h-[210px] items-center justify-center bg-[radial-gradient(circle_at_center,rgba(184,242,106,0.06),transparent_65%)]">
              <div className="absolute h-[180px] w-[180px] rounded-full border border-white/[0.07]" />
              <div className="absolute h-[120px] w-[120px] rounded-full border border-white/[0.06]" />
              <div className="absolute h-[60px] w-[60px] rounded-full border border-white/[0.06]" />
              <div className="absolute h-[180px] w-[180px] animate-radar-sweep rounded-full bg-[conic-gradient(from_0deg,rgba(184,242,106,0.18),transparent_28%)]" />
              <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border border-signal-lime/30 bg-signal-lime/10 text-signal-lime">
                <Radar className="h-5 w-5" />
              </div>
              <span className="absolute left-[30%] top-[32%] h-1.5 w-1.5 rounded-full bg-signal-mint shadow-[0_0_8px_#5eead4]" />
              <span className="absolute right-[28%] top-[45%] h-1 w-1 rounded-full bg-signal-lime shadow-[0_0_8px_#b8f26a]" />
              <span className="absolute bottom-[30%] left-[45%] h-1.5 w-1.5 rounded-full bg-signal-violet shadow-[0_0_8px_#a78bfa]" />
            </div>
            <div className="border-t border-white/[0.06] p-4">
              <p className="text-[11px] leading-relaxed text-muted-foreground/65">
                The radar places recent signals by category and recency. Every blip opens evidence, source and publication date.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
