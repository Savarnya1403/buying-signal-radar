import { PageHeader } from "@/components/shell/page-header";
import { SourcesManager } from "@/components/sources/sources-manager";
import { Button } from "@/components/ui/button";
import { QuickRunButton } from "@/components/discovery/quick-run-button";
import { ensureWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import { CONNECTOR_CATALOG } from "@/lib/connectors";
import { ExternalLink, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const workspace = await ensureWorkspace();
  const [sources, runs] = await Promise.all([
    prisma.source.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "asc" },
      include: { runs: { orderBy: { startedAt: "desc" }, take: 3 } },
    }),
    prisma.ingestionRun.findMany({
      where: { workspaceId: workspace.id },
      include: { source: { select: { name: true } } },
      orderBy: { startedAt: "desc" },
      take: 12,
    }),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Signal sources"
        title={<>Connectors, <span className="text-gradient">permissions and provenance.</span></>}
        description="RSS, public job feeds, Show HN, company pages and URLs you explicitly submit. One authorised search API if configured. Every run is logged with what was fetched, kept and rejected."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <a href="https://github.com/Savarnya1403/buying-signal-radar/blob/main/docs/connectors.md" target="_blank" rel="noopener noreferrer">
                Connector docs <ExternalLink />
              </a>
            </Button>
            <QuickRunButton size="sm" />
          </>
        }
      />

      <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-signal-mint/15 bg-signal-mint/[0.04] px-4 py-3">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signal-mint/70" />
        <p className="text-[11px] leading-relaxed text-muted-foreground/65">
          <span className="font-medium text-signal-mint/90">Collection policy.</span> Public, permitted sources only. No LinkedIn scraping, login bypass, paywall circumvention, robots evasion or IP rotation. Each signal stores the source name, a link and the date it was published.
        </p>
      </div>

      <SourcesManager
        sources={sources.map((source) => ({
          id: source.id,
          type: source.type,
          name: source.name,
          url: source.url,
          config: source.config,
          enabled: source.enabled,
          lastRunAt: source.lastRunAt?.toISOString() ?? null,
          lastStatus: source.lastStatus,
          lastError: source.lastError,
          lastFetched: source.lastFetched,
          runs: source.runs.map((run) => ({
            id: run.id,
            status: run.status,
            startedAt: run.startedAt.toISOString(),
            itemsFetched: run.itemsFetched,
            signalsCreated: run.signalsCreated,
            duplicates: run.duplicates,
            error: run.error,
          })),
        }))}
        catalog={CONNECTOR_CATALOG.map((item) => ({
          type: item.type,
          label: item.label,
          description: item.description,
          permission: item.permission,
          available: item.available,
          example: item.example,
        }))}
        runs={runs.map((run) => ({
          id: run.id,
          status: run.status,
          trigger: run.trigger,
          startedAt: run.startedAt.toISOString(),
          finishedAt: run.finishedAt?.toISOString() ?? null,
          itemsFetched: run.itemsFetched,
          signalsCreated: run.signalsCreated,
          companiesCreated: run.companiesCreated,
          duplicates: run.duplicates,
          sourceName: run.source?.name ?? null,
          error: run.error,
        }))}
      />
    </div>
  );
}
