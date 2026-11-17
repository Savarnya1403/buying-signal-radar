import { PageHeader } from "@/components/shell/page-header";
import { DiscoverWizard } from "@/components/discovery/discover-wizard";
import { ensureWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const workspace = await ensureWorkspace();
  const [icp, sources] = await Promise.all([
    prisma.icpProfile.findFirst({
      where: { workspaceId: workspace.id, isConfirmed: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.source.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, type: true, enabled: true, lastStatus: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Discover prospects"
        title={icp ? "Refine the ICP, then scan permitted public sources." : "Describe what you sell. We extract the ICP."}
        description={
          icp
            ? "Every field is editable and evidence-backed. Confirming creates a new ICP version and re-ranks your existing prospects — it never silently overwrites the last one."
            : "Plain English in, structured ICP out. Review the reading, edit anything, choose your signals and period, then run discovery across RSS, public job feeds, Show HN, company pages and URLs you add."
        }
      />

      <DiscoverWizard
        initialIcp={icp ? {
          id: icp.id,
          productDescription: icp.productDescription,
          productCategory: icp.productCategory,
          targetIndustries: icp.targetIndustries,
          companySizeMin: icp.companySizeMin,
          companySizeMax: icp.companySizeMax,
          geographies: icp.geographies,
          buyerRoles: icp.buyerRoles,
          painPoints: icp.painPoints,
          buyingTriggers: icp.buyingTriggers,
          exclusions: icp.exclusions,
          selectedSignalTypes: icp.selectedSignalTypes,
          discoveryPeriodDays: icp.discoveryPeriodDays,
          confidence: icp.confidence,
          rationale: icp.rationale,
        } : null}
        sources={sources}
      />
    </div>
  );
}
