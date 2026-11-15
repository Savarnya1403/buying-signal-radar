import { PageHeader } from "@/components/shell/page-header";
import { ReportsManager } from "@/components/reports/reports-manager";
import { ensureWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const workspace = await ensureWorkspace();
  const reports = await prisma.report.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        eyebrow="Reports"
        title={<>Share the evidence, <span className="text-gradient">not the private data.</span></>}
        description="Publish a read-only snapshot of ranked prospects with scores, signals and links. Contacts, notes, statuses and referral-graph relationships are excluded by design."
      />

      <ReportsManager
        reports={reports.map((report) => ({
          id: report.id,
          token: report.token,
          title: report.title,
          industry: report.industry,
          companyCount: report.companyCount,
          dataMode: report.dataMode,
          createdAt: report.createdAt.toISOString(),
          dateRangeStart: report.dateRangeStart.toISOString(),
          dateRangeEnd: report.dateRangeEnd.toISOString(),
          signalBreakdown: (report.signalBreakdown ?? {}) as Record<string, number>,
          payload: (report.payload ?? {}) as { demoCompanyCount?: number; liveCompanyCount?: number; disclaimer?: string },
        }))}
      />
    </div>
  );
}
