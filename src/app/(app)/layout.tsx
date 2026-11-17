import { ensureWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { MobileBar } from "@/components/shell/mobile-bar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const workspace = await ensureWorkspace();
  const [icp, signalCount, savedCount, contactCount, sources] = await Promise.all([
    prisma.icpProfile.findFirst({
      where: { workspaceId: workspace.id, isConfirmed: true },
      orderBy: { createdAt: "desc" },
      select: { productCategory: true, targetIndustries: true },
    }),
    prisma.signal.count({ where: { workspaceId: workspace.id } }),
    prisma.prospect.count({ where: { workspaceId: workspace.id, status: { in: ["SAVED", "CONTACTED"] } } }),
    prisma.contact.count({ where: { workspaceId: workspace.id } }),
    prisma.source.findMany({
      where: { workspaceId: workspace.id, enabled: true },
      select: { lastStatus: true },
    }),
  ]);

  const failingSources = sources.filter((source) => source.lastStatus === "FAILED").length;

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,rgba(184,242,106,0.045),transparent_55%)]" />
      <div className="pointer-events-none fixed inset-0 z-0 grid-fade opacity-40" />
      <AppSidebar
        workspaceName={workspace.name}
        category={icp?.productCategory ?? null}
        signalCount={signalCount}
        savedCount={savedCount}
        contactCount={contactCount}
        failingSources={failingSources}
      />
      <MobileBar savedCount={savedCount} />
      <main className="relative z-10 pb-20 pt-16 md:pl-[252px] md:pt-0">
        <div className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 md:px-8 md:py-9">{children}</div>
      </main>
    </div>
  );
}
