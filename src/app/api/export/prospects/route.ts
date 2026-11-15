import { apiError, withWorkspace } from "@/lib/api";
import { prisma } from "@/lib/db";
import { toCsv } from "@/lib/contacts/csv";
import { SIGNAL_META } from "@/lib/signals";

export async function GET() {
  return withWorkspace(async (workspace) => {
    const icp = await prisma.icpProfile.findFirst({
      where: { workspaceId: workspace.id, isConfirmed: true },
      orderBy: { createdAt: "desc" },
    });
    if (!icp) return apiError("No confirmed ICP to export.", 409, "NO_ICP");

    const prospects = await prisma.prospect.findMany({
      where: { workspaceId: workspace.id, icpProfileId: icp.id },
      include: {
        company: { include: { signals: { orderBy: { discoveredAt: "desc" } } } },
      },
      orderBy: { priorityScore: "desc" },
    });

    const headers = [
      "company", "website", "industry", "location", "employee_count", "employee_range", "size_source",
      "icp_score", "signal_score", "priority_score", "status", "signal_types", "signal_count",
      "latest_signal_date", "source_links", "buyer_role_hypotheses", "notes", "data_mode",
    ];

    const rows = prospects.map((prospect) => {
      const roles = [
        ...new Set(
          prospect.company.signals.flatMap((signal) => {
            const matches = signal.title.match(/\b(VP|Head of|Chief|Director of)\s+[A-Z][A-Za-z]+/g) ?? [];
            return matches;
          }),
        ),
      ];
      const latest = prospect.company.signals.reduce<Date | null>((value, signal) => {
        const date = signal.publishedAt ?? signal.discoveredAt;
        return !value || date > value ? date : value;
      }, null);
      return [
        prospect.company.name,
        prospect.company.website ?? "",
        prospect.company.industry ?? "Unverified",
        prospect.company.location ?? "Unverified",
        prospect.company.employeeCount ?? "",
        prospect.company.employeeRange ?? "",
        prospect.company.sizeSource ?? "",
        prospect.icpScore,
        prospect.signalScore,
        prospect.priorityScore,
        prospect.status,
        [...new Set(prospect.company.signals.map((signal) => SIGNAL_META[signal.type].label))].join("; "),
        prospect.company.signals.length,
        latest ? latest.toISOString().slice(0, 10) : "",
        prospect.company.signals.map((signal) => signal.sourceUrl).join(" | "),
        roles.join("; "),
        prospect.notes ?? "",
        prospect.company.signals.some((signal) => signal.dataMode === "DEMO") ? "DEMO" : "LIVE",
      ];
    });

    const csv = toCsv(headers, rows);
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="buying-signal-radar-prospects-${new Date().toISOString().slice(0, 10)}.csv"`,
        "cache-control": "no-store",
      },
    });
  });
}
