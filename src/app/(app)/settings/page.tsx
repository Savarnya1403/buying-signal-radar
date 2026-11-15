import Link from "next/link";
import { Database, FileDown, KeyRound, ShieldCheck, SlidersHorizontal, Sparkles, UserCog } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScoringSettings } from "@/components/settings/scoring-settings";
import { WorkspaceForm } from "@/components/settings/workspace-form";
import { DemoControls } from "@/components/settings/demo-controls";
import { ensureWorkspace, getScoringConfig } from "@/lib/workspace";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const workspace = await ensureWorkspace();
  const [scoring, icp, companyCount, signalCount, contactCount, reportCount, demoSignals, totalSignals] = await Promise.all([
    getScoringConfig(workspace.id),
    prisma.icpProfile.findFirst({ where: { workspaceId: workspace.id, isConfirmed: true }, orderBy: { createdAt: "desc" } }),
    prisma.company.count({ where: { workspaceId: workspace.id } }),
    prisma.signal.count({ where: { workspaceId: workspace.id } }),
    prisma.contact.count({ where: { workspaceId: workspace.id } }),
    prisma.report.count({ where: { workspaceId: workspace.id } }),
    prisma.signal.count({ where: { workspaceId: workspace.id, dataMode: "DEMO" } }),
    prisma.signal.count({ where: { workspaceId: workspace.id } }),
  ]);

  const allDemo = totalSignals > 0 && demoSignals === totalSignals;
  const tavily = Boolean(process.env.TAVILY_API_KEY);
  const brave = Boolean(process.env.BRAVE_SEARCH_API_KEY);

  return (
    <div>
      <PageHeader
        eyebrow="Settings & scoring"
        title={<>Make the ranking <span className="text-gradient">yours.</span></>}
        description="Tune how ICP fit, signal evidence and recency combine. Every change re-scores the current ICP and keeps the component breakdown visible."
        actions={
          <Button asChild variant="outline" size="sm"><Link href="/discover"><SlidersHorizontal /> Edit ICP</Link></Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="panel p-4">
          <p className="label-mono">Current ICP</p>
          <p className="mt-2 truncate text-[13px] font-medium text-foreground/85">{icp?.productCategory ?? "Not confirmed"}</p>
          <p className="mt-1 text-[10px] text-muted-foreground/45">{icp ? `Version ${icp.version} · ${icp.isDemo ? "demo profile" : "your profile"}` : "Describe your product to begin"}</p>
        </div>
        <div className="panel p-4">
          <p className="label-mono">Workspace data</p>
          <p className="mt-2 font-mono text-[15px] text-foreground/85">{companyCount} companies · {signalCount} signals</p>
          <p className="mt-1 text-[10px] text-muted-foreground/45">{contactCount} private contacts · {reportCount} reports</p>
        </div>
        <div className="panel p-4">
          <p className="label-mono">Data mode</p>
          <p className="mt-2"><Badge variant={allDemo ? "demo" : signalCount > 0 ? "primary" : "outline"}>{allDemo ? "Demo dataset" : signalCount > 0 ? "Live evidence" : "No signals yet"}</Badge></p>
          <p className="mt-1 text-[10px] text-muted-foreground/45">{allDemo ? "Synthetic and clearly labelled everywhere" : "Mixed or live data is labelled per signal"}</p>
        </div>
        <div className="panel p-4">
          <p className="label-mono">Search API</p>
          <p className="mt-2 flex items-center gap-1.5 font-mono text-[12px] text-foreground/80">
            <KeyRound className="h-3 w-3 text-muted-foreground/50" /> {tavily ? "Tavily configured" : brave ? "Brave configured" : "Not configured"}
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/45">{tavily || brave ? "The authorised search connector is available." : "Optional. All other connectors work without a key."}</p>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {[
          { href: "#scoring", label: "Scoring weights", icon: <SlidersHorizontal className="h-3 w-3" /> },
          { href: "#workspace", label: "Workspace", icon: <UserCog className="h-3 w-3" /> },
          { href: "#data", label: "Data & privacy", icon: <ShieldCheck className="h-3 w-3" /> },
        ].map((item) => (
          <Button key={item.href} asChild variant="outline" size="sm" className="h-7 text-[10px]">
            <a href={item.href}>{item.icon} {item.label}</a>
          </Button>
        ))}
      </div>

      <section id="scoring" className="scroll-mt-24">
        <ScoringSettings initial={scoring} />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section id="workspace" className="panel scroll-mt-24 p-5">
          <div className="flex items-center gap-2">
            <UserCog className="h-3.5 w-3.5 text-signal-mint" />
            <p className="label-mono">Workspace</p>
          </div>
          <div className="mt-4">
            <WorkspaceForm initialName={workspace.name} workspaceId={workspace.id} />
          </div>
        </section>

        <section id="data" className="panel scroll-mt-24 p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-signal-mint" />
            <p className="label-mono">Data &amp; privacy</p>
          </div>
          <div className="mt-3 space-y-2.5 text-[11px] leading-relaxed text-muted-foreground/60">
            <p>Contacts, notes, statuses and referral relationships are private to this workspace. Shared reports exclude all of them by design.</p>
            <p>Signals retain their source URL, source name, publication date and the exact evidence used for classification. Demo signals are labelled at the record level.</p>
            <p>No LinkedIn scraping, authentication bypass, paywall circumvention, robots evasion or IP rotation is implemented anywhere.</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm"><a href="/api/export/prospects"><FileDown /> Export prospects CSV</a></Button>
            <Button asChild variant="ghost" size="sm"><a href="/api/health" target="_blank" rel="noopener noreferrer"><Database /> Health check</a></Button>
          </div>
          <div className="mt-4 rounded-lg border border-white/[0.055] bg-white/[0.015] p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-medium text-foreground/75"><Sparkles className="h-3 w-3 text-[#c4b5fd]" /> Demo dataset</p>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/45">
              Synthetic companies, people and evidence. Always labelled. Use it to explore the flow before adding your own sources.
            </p>
            <div className="mt-2.5"><DemoControls seeded={workspace.demoSeededAt != null || allDemo} /></div>
          </div>
        </section>
      </div>

      <div className="mt-4 rounded-lg border border-white/[0.055] bg-white/[0.015] p-4 text-[10px] leading-relaxed text-muted-foreground/45">
        <span className="font-medium text-foreground/70">About this MVP.</span> Buying Signal Radar is open source under the MIT licence. The workspace is cookie-scoped rather than authenticated — deploy behind your own access control before putting real contact data in a public instance. Scoring is deterministic and rules-based; no external LLM key is required.
      </div>
    </div>
  );
}
