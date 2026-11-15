import Link from "next/link";
import { Bookmark, CheckCircle2, Download, Send, StickyNote, Target } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CompanyAvatar,
  DataModeBadge,
  DemoBanner,
  EmptyState,
  SignalBadge,
} from "@/components/shared/display";
import { ProspectQuickActions } from "@/components/companies/prospect-quick-actions";
import { DemoLoader } from "@/components/demo/demo-loader";
import { ensureWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import { relativeTime, scoreTone, truncate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const workspace = await ensureWorkspace();
  const [prospects, demoSignals, totalSignals] = await Promise.all([
    prisma.prospect.findMany({
      where: { workspaceId: workspace.id, status: { in: ["SAVED", "CONTACTED"] } },
      include: {
        company: {
          include: { signals: { orderBy: [{ publishedAt: "desc" }, { discoveredAt: "desc" }], take: 4 } },
        },
      },
      orderBy: [{ contactedAt: "desc" }, { savedAt: "desc" }, { priorityScore: "desc" }],
    }),
    prisma.signal.count({ where: { workspaceId: workspace.id, dataMode: "DEMO" } }),
    prisma.signal.count({ where: { workspaceId: workspace.id } }),
  ]);

  const saved = prospects.filter((prospect) => prospect.status === "SAVED");
  const contacted = prospects.filter((prospect) => prospect.status === "CONTACTED");
  const allDemo = totalSignals > 0 && demoSignals === totalSignals;

  return (
    <div>
      <PageHeader
        eyebrow="Action centre"
        title={<>Saved and contacted <span className="text-gradient">prospects.</span></>}
        description="A lightweight pipeline, not a CRM. Keep the evidence, your notes and the next step together. Export any time — nothing is locked in."
        actions={
          <>
            <Button asChild variant="outline" size="sm"><a href="/api/export/prospects"><Download /> Export all prospects</a></Button>
            <Button asChild size="sm" variant="outline"><Link href="/companies"><Target /> Browse companies</Link></Button>
          </>
        }
      />

      {allDemo && <div className="mb-4"><DemoBanner compact /></div>}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="panel p-4">
          <p className="label-mono">Saved</p>
          <p className="mt-2 font-mono text-[26px] leading-none text-signal-lime">{saved.length}</p>
          <p className="mt-1.5 text-[10px] text-muted-foreground/50">Ready to work</p>
        </div>
        <div className="panel p-4">
          <p className="label-mono">Contacted</p>
          <p className="mt-2 font-mono text-[26px] leading-none text-signal-mint">{contacted.length}</p>
          <p className="mt-1.5 text-[10px] text-muted-foreground/50">Awaiting reply or in conversation</p>
        </div>
        <div className="panel p-4">
          <p className="label-mono">With notes</p>
          <p className="mt-2 font-mono text-[26px] leading-none text-foreground/85">{prospects.filter((prospect) => prospect.notes).length}</p>
          <p className="mt-1.5 text-[10px] text-muted-foreground/50">Private to this workspace</p>
        </div>
        <div className="panel p-4">
          <p className="label-mono">Median priority</p>
          <p className={cn("mt-2 font-mono text-[26px] leading-none", scoreTone(prospects.length ? Math.round(prospects.reduce((sum, prospect) => sum + prospect.priorityScore, 0) / prospects.length) : 0))}>
            {prospects.length ? Math.round(prospects.reduce((sum, prospect) => sum + prospect.priorityScore, 0) / prospects.length) : "—"}
          </p>
          <p className="mt-1.5 text-[10px] text-muted-foreground/50">An index, not a probability</p>
        </div>
      </div>

      {prospects.length === 0 ? (
        <EmptyState
          icon={<Bookmark className="h-5 w-5" />}
          title="Nothing saved yet"
          description="Open a ranked company and save it when the evidence is worth acting on. Saved, contacted and disqualified statuses stay separate from the underlying scores."
          actions={
            <>
              <Button asChild><Link href="/companies"><Target /> Browse ranked companies</Link></Button>
              <DemoLoader variant="outline" />
            </>
          }
        />
      ) : (
        <div className="space-y-4">
          <SavedSection
            title="Saved for follow-up"
            icon={<Bookmark className="h-3.5 w-3.5" />}
            prospects={saved}
            emptyText="No prospects saved yet. Use Save on any company row."
          />
          <SavedSection
            title="Contacted"
            icon={<Send className="h-3.5 w-3.5" />}
            prospects={contacted}
            emptyText="Nothing marked as contacted yet."
          />
        </div>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          { title: "Copy source links", detail: "Every row can copy the evidence links so you can paste them into an email or doc with attribution." },
          { title: "Notes stay private", detail: "Your notes and statuses are never included in a shared report or public link." },
          { title: "Export in one click", detail: "CSV includes scores, signal types, source links, buyer-role hypotheses and your notes." },
        ].map((item) => (
          <div key={item.title} className="rounded-lg border border-white/[0.055] bg-white/[0.015] p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-foreground/80">
              <CheckCircle2 className="h-3 w-3 text-signal-mint/70" /> {item.title}
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/50">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SavedSection({
  title,
  icon,
  prospects,
  emptyText,
}: {
  title: string;
  icon: React.ReactNode;
  prospects: {
    id: string;
    status: string;
    priorityScore: number;
    signalScore: number;
    icpScore: number;
    notes: string | null;
    savedAt: Date | null;
    contactedAt: Date | null;
    lastSignalAt: Date | null;
    company: {
      id: string;
      name: string;
      industry: string | null;
      location: string | null;
      employeeCount: number | null;
      isDemo: boolean;
      signals: { id: string; type: string; title: string }[];
    };
  }[];
  emptyText: string;
}) {
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-signal-lime/80">{icon}</span>
          <p className="label-mono">{title}</p>
        </div>
        <Badge variant="outline" className="font-mono text-[8px]">{prospects.length}</Badge>
      </div>
      <div className="divide-y divide-white/[0.045]">
        {prospects.map((prospect) => (
          <div key={prospect.id} className="relative grid gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.022] sm:grid-cols-[1fr_auto] sm:items-center">
            <Link href={`/companies/${prospect.company.id}`} className="absolute inset-0 z-0" aria-label={`Open ${prospect.company.name}`} />
            <div className="relative z-10 flex min-w-0 items-start gap-3">
              <CompanyAvatar name={prospect.company.name} demo={prospect.company.isDemo} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-[13px] font-medium text-foreground">{prospect.company.name}</p>
                  {prospect.company.isDemo && <Badge variant="demo">Demo</Badge>}
                  <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/45">{prospect.company.industry ?? "Industry unverified"}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {prospect.company.signals.slice(0, 3).map((signal) => <SignalBadge key={signal.id} type={signal.type} compact />)}
                  {prospect.company.signals.length === 0 && <span className="text-[10px] text-muted-foreground/40">No signals attached</span>}
                </div>
                {prospect.notes && (
                  <div className="mt-1.5 flex items-start gap-1.5 text-[10px] leading-relaxed text-muted-foreground/55">
                    <StickyNote className="mt-0.5 h-2.5 w-2.5 shrink-0 text-signal-amber/60" />
                    <span className="line-clamp-2">{truncate(prospect.notes, 180)}</span>
                  </div>
                )}
                <p className="mt-1 font-mono text-[9px] text-muted-foreground/40">
                  {prospect.status === "CONTACTED" ? `Contacted ${relativeTime(prospect.contactedAt)}` : `Saved ${relativeTime(prospect.savedAt)}`}
                  {prospect.lastSignalAt ? ` · latest signal ${relativeTime(prospect.lastSignalAt)}` : ""}
                </p>
              </div>
            </div>
            <div className="relative z-10 flex items-center gap-3">
              <div className="hidden gap-3 sm:flex">
                <div className="text-right"><p className={cn("font-mono text-[13px] tabular-nums", scoreTone(prospect.icpScore))}>{prospect.icpScore}</p><p className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground/35">ICP</p></div>
                <div className="text-right"><p className={cn("font-mono text-[13px] tabular-nums", scoreTone(prospect.signalScore))}>{prospect.signalScore}</p><p className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground/35">Signal</p></div>
                <div className="text-right"><p className={cn("font-mono text-[17px] tabular-nums", scoreTone(prospect.priorityScore))}>{prospect.priorityScore}</p><p className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground/35">Priority</p></div>
              </div>
              <ProspectQuickActions
                compact
                prospectId={prospect.id}
                companyId={prospect.company.id}
                status={prospect.status}
                sourceLinks={[]}
              />
            </div>
          </div>
        ))}
        {prospects.length === 0 && <p className="px-4 py-8 text-center text-[11px] text-muted-foreground/45">{emptyText}</p>}
      </div>
    </div>
  );
}
