import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Download,
  MapPin,
  Radar,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { Prisma, SignalType } from "@prisma/client";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CompanyAvatar,
  EmptyState,
  SignalBadge,
  Unverified,
} from "@/components/shared/display";
import { CompanyFilters } from "@/components/companies/company-filters";
import { ProspectQuickActions } from "@/components/companies/prospect-quick-actions";
import { ensureWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import { SIGNAL_META, SIGNAL_TYPES } from "@/lib/signals";
import { relativeTime, scoreTone, truncate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  sort?: string;
  status?: string;
  signal?: string;
  industry?: string;
}>;

const STATUS_LABEL: Record<string, string> = {
  NEW: "New",
  SAVED: "Saved",
  CONTACTED: "Contacted",
  DISQUALIFIED: "Disqualified",
};

export default async function CompaniesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const workspace = await ensureWorkspace();
  const icp = await prisma.icpProfile.findFirst({
    where: { workspaceId: workspace.id, isConfirmed: true },
    orderBy: { createdAt: "desc" },
  });

  if (!icp) {
    return (
      <div>
        <PageHeader eyebrow="Companies" title="Ranked companies appear here." description="Confirm an ICP and run discovery to rank companies against your market." />
        <EmptyState
          icon={<Radar className="h-5 w-5" />}
          title="No ICP yet"
          description="Buying Signal Radar needs to know what you sell before it can rank companies. Describe your product in plain English — it takes about a minute."
          actions={
            <Button asChild><Link href="/discover"><Radar /> Describe your product</Link></Button>
          }
        />
      </div>
    );
  }

  const sort = params.sort ?? "priority";
  const status = params.status ?? "active";
  const signal = params.signal && SIGNAL_TYPES.includes(params.signal as SignalType) ? (params.signal as SignalType) : null;
  const q = params.q?.trim() ?? "";

  const where: Prisma.ProspectWhereInput = {
    workspaceId: workspace.id,
    icpProfileId: icp.id,
    ...(status === "active" ? { status: { not: "DISQUALIFIED" } } : status !== "all" ? { status: status as "NEW" | "SAVED" | "CONTACTED" | "DISQUALIFIED" } : {}),
    ...(signal ? { company: { signals: { some: { type: signal } } } } : {}),
    ...(params.industry ? { company: { ...(signal ? { signals: { some: { type: signal } } } : {}), industry: params.industry } } : {}),
    ...(q
      ? {
          company: {
            ...(signal ? { signals: { some: { type: signal } } } : {}),
            ...(params.industry ? { industry: params.industry } : {}),
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { domain: { contains: q, mode: "insensitive" } },
              { industry: { contains: q, mode: "insensitive" } },
              { location: { contains: q, mode: "insensitive" } },
            ],
          },
        }
      : {}),
  };

  const orderBy: Prisma.ProspectOrderByWithRelationInput[] =
    sort === "signal" ? [{ signalScore: "desc" }, { priorityScore: "desc" }] :
    sort === "icp" ? [{ icpScore: "desc" }, { priorityScore: "desc" }] :
    sort === "recent" ? [{ lastSignalAt: { sort: "desc", nulls: "last" } }, { priorityScore: "desc" }] :
    sort === "name" ? [{ company: { name: "asc" } }] :
    [{ priorityScore: "desc" }, { signalScore: "desc" }];

  const [prospects, totalActive, industriesRaw] = await Promise.all([
    prisma.prospect.findMany({
      where,
      include: {
        company: {
          include: {
            signals: { orderBy: [{ publishedAt: "desc" }, { discoveredAt: "desc" }], take: 6 },
          },
        },
      },
      orderBy,
      take: 150,
    }),
    prisma.prospect.count({ where: { workspaceId: workspace.id, icpProfileId: icp.id, status: { not: "DISQUALIFIED" } } }),
    prisma.company.findMany({
      where: { workspaceId: workspace.id, industry: { not: null } },
      select: { industry: true },
      distinct: ["industry"],
      orderBy: { industry: "asc" },
    }),
  ]);

  const industries = industriesRaw
    .map((row) => row.industry)
    .filter((value): value is string => Boolean(value))
    .map((value) => ({ value, label: value }));

  return (
    <div>
      <PageHeader
        eyebrow="Companies"
        title={<>Every prospect, with the evidence <span className="text-gradient">behind its rank.</span></>}
        description={
          <>
            {totalActive} active prospects for <span className="text-foreground/80">{icp.productCategory}</span>. ICP-fit, signal strength and priority are separate indices — never probabilities of purchase.
          </>
        }
        actions={
          <>
            <Button asChild variant="outline" size="sm"><a href="/api/export/prospects"><Download /> Export CSV</a></Button>
            <Button asChild size="sm"><Link href="/discover"><Radar /> Run discovery</Link></Button>
          </>
        }
      />

      <CompanyFilters
        total={prospects.length}
        industries={industries}
        signalOptions={SIGNAL_TYPES.map((type) => ({ value: type, label: SIGNAL_META[type].label }))}
      />

      {prospects.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={<Search className="h-5 w-5" />}
            title={totalActive === 0 ? "No prospects ranked yet" : "No companies match these filters"}
            description={
              totalActive === 0
                ? "Run discovery against the permitted public sources you selected to see how ranking and evidence work."
                : "Try a broader search, clear the signal filter, or include disqualified prospects. Filters never change the underlying scores."
            }
            actions={
              totalActive === 0 ? (
                <Button asChild><Link href="/discover"><Radar /> Run discovery</Link></Button>
              ) : (
                <Button asChild variant="outline"><Link href="/companies">Clear filters</Link></Button>
              )
            }
          />
        </div>
      ) : (
        <div className="panel mt-4 overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,1.7fr)_minmax(0,1.1fr)_130px_92px_88px_74px_40px] items-center gap-3 border-b border-white/[0.06] px-4 py-2.5 lg:grid">
            <span className="label-mono">Company</span>
            <span className="label-mono">Buying signals</span>
            <span className="label-mono">Fit &amp; reach</span>
            <span className="label-mono text-right">ICP</span>
            <span className="label-mono text-right">Signal</span>
            <span className="label-mono text-right">Priority</span>
            <span className="sr-only">Actions</span>
          </div>

          <div className="divide-y divide-white/[0.045]">
            {prospects.map((prospect) => {
              const company = prospect.company;
              const latest = company.signals[0];
              return (
                <div
                  key={prospect.id}
                  className="group relative grid gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.022] lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1.1fr)_130px_92px_88px_74px_40px] lg:items-center"
                >
                  <Link href={`/companies/${company.id}`} className="absolute inset-0 z-0" aria-label={`Open ${company.name}`} />

                  <div className="relative z-10 flex min-w-0 items-start gap-3">
                    <CompanyAvatar name={company.name} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-[13px] font-medium text-foreground">{company.name}</p>
                        <Badge variant="outline" className="font-mono text-[9px]">LIVE</Badge>
                        {prospect.status !== "NEW" && (
                          <Badge variant={prospect.status === "DISQUALIFIED" ? "destructive" : prospect.status === "SAVED" ? "primary" : "sky"} className="font-mono text-[9px]">
                            {STATUS_LABEL[prospect.status]}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-muted-foreground/60">
                        {company.industry ? <span>{company.industry}</span> : <Unverified>industry</Unverified>}
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-2.5 w-2.5" />
                          {company.location ?? "Location unverified"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-2.5 w-2.5" />
                          {company.employeeCount ? `${company.employeeCount.toLocaleString()} employees` : company.employeeRange ?? "Size unverified"}
                        </span>
                      </div>
                      {latest && (
                        <p className="mt-1.5 line-clamp-1 text-[10px] leading-snug text-muted-foreground/45">
                          Latest: {truncate(latest.title, 110)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="relative z-10 flex flex-wrap items-center gap-1.5">
                    {[...new Set(company.signals.map((item) => item.type))].slice(0, 3).map((type) => (
                      <SignalBadge key={type} type={type} compact />
                    ))}
                    {company.signals.length === 0 && <span className="text-[10px] text-muted-foreground/40">No evidence yet</span>}
                    {company.signals.length > 3 && (
                      <span className="font-mono text-[9px] text-muted-foreground/40">+{company.signals.length - 3}</span>
                    )}
                  </div>

                  <div className="relative z-10 flex items-center gap-2 text-[10px] text-muted-foreground/60">
                    <ShieldCheck className={`h-3 w-3 ${prospect.scoreBreakdown && (prospect.scoreBreakdown as { icp?: { excluded?: boolean } }).icp?.excluded ? "text-signal-rose" : "text-signal-mint/70"}`} />
                    <span>
                      {(prospect.scoreBreakdown as { icp?: { excluded?: boolean } }).icp?.excluded
                        ? "Exclusion matched"
                        : prospect.icpScore >= 55
                          ? "Strong fit"
                          : "Partial fit"}
                    </span>
                    <span className="text-muted-foreground/30">·</span>
                    <span>{prospect.lastSignalAt ? relativeTime(prospect.lastSignalAt) : "No dated signal"}</span>
                  </div>

                  <div className="relative z-10 flex gap-6 lg:contents">
                    <div className="lg:text-right">
                      <p className={`font-mono text-[15px] tabular-nums ${scoreTone(prospect.icpScore)}`}>{prospect.icpScore}</p>
                      <p className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground/40 lg:hidden">ICP fit</p>
                    </div>
                    <div className="lg:text-right">
                      <p className={`font-mono text-[15px] tabular-nums ${scoreTone(prospect.signalScore)}`}>{prospect.signalScore}</p>
                      <p className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground/40 lg:hidden">Signal</p>
                    </div>
                    <div className="lg:text-right">
                      <p className={`font-mono text-[18px] font-medium tabular-nums ${scoreTone(prospect.priorityScore)}`}>{prospect.priorityScore}</p>
                      <p className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground/40 lg:hidden">Priority</p>
                    </div>
                  </div>

                  <div className="relative z-20 flex justify-end">
                    <ProspectQuickActions
                      compact
                      prospectId={prospect.id}
                      companyId={company.id}
                      status={prospect.status}
                      sourceLinks={company.signals.map((item) => item.sourceUrl)}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] px-4 py-3">
            <p className="text-[10px] text-muted-foreground/45">
              Showing {prospects.length}{prospects.length === 150 ? "+" : ""} of {totalActive} active prospects. Scores re-compute when signals or weights change.
            </p>
            <div className="flex items-center gap-3">
              <Button asChild variant="ghost" size="sm" className="h-7 text-[11px]">
                <Link href="/settings">Tune scoring <ArrowRight className="h-3 w-3" /></Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          { icon: <Building2 className="h-3.5 w-3.5" />, title: "Verified size only", detail: "Headcount is shown with its source. Missing values are labelled unverified and receive neutral partial credit." },
          { icon: <ShieldCheck className="h-3.5 w-3.5" />, title: "Scores are indices", detail: "ICP-fit measures profile match; signal score measures public intent evidence. Neither is a purchase probability." },
          { icon: <Radar className="h-3.5 w-3.5" />, title: "Every signal has a source", detail: "Open a company to see the exact quote, publication date, source name and outbound link." },
        ].map((item) => (
          <div key={item.title} className="rounded-lg border border-white/[0.055] bg-white/[0.015] p-3">
            <div className="flex items-center gap-2 text-[11px] font-medium text-foreground/80">
              <span className="text-signal-lime/80">{item.icon}</span> {item.title}
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/55">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
