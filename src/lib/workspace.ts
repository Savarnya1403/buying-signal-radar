import "server-only";
import { cookies, headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { mergeScoringConfig, type ScoringConfig } from "@/lib/scoring/config";

export const WORKSPACE_COOKIE = "bsr_workspace";

function isValidWorkspaceId(value: string | undefined | null): value is string {
  return Boolean(value && /^[a-zA-Z0-9_-]{16,64}$/.test(value));
}

export async function getWorkspaceId(): Promise<string | null> {
  const headerStore = await headers();
  const headerId = headerStore.get("x-bsr-workspace");
  if (isValidWorkspaceId(headerId)) return headerId;
  const cookieStore = await cookies();
  const cookieId = cookieStore.get(WORKSPACE_COOKIE)?.value;
  return isValidWorkspaceId(cookieId) ? cookieId : null;
}

export async function ensureWorkspace() {
  const id = await getWorkspaceId();
  if (!id) throw new Error("No workspace session. Refresh the page to establish a private workspace.");

  // Layout and page components render in parallel, so two requests can race to
  // create the same workspace. Read first, then create and recover from P2002.
  const existing = await prisma.workspace.findUnique({ where: { id } });
  if (existing) return existing;

  try {
    return await prisma.workspace.create({ data: { id, name: "My workspace" } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raced = await prisma.workspace.findUnique({ where: { id } });
      if (raced) return raced;
    }
    throw error;
  }
}

export async function getCurrentIcp(workspaceId: string) {
  return prisma.icpProfile.findFirst({
    where: { workspaceId, isConfirmed: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getLatestIcp(workspaceId: string) {
  return prisma.icpProfile.findFirst({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getScoringConfig(workspaceId: string): Promise<ScoringConfig> {
  const profile = await prisma.scoringProfile.findUnique({ where: { workspaceId } });
  if (!profile) return mergeScoringConfig({});
  return mergeScoringConfig({
    icpWeights: profile.icpWeights,
    signalWeights: profile.signalCategoryWeights,
    priorityIcpWeight: profile.priorityIcpWeight,
    prioritySignalWeight: profile.prioritySignalWeight,
    recencyHalfLifeDays: profile.recencyHalfLifeDays,
  });
}

export async function saveScoringConfig(workspaceId: string, config: ScoringConfig) {
  return prisma.scoringProfile.upsert({
    where: { workspaceId },
    update: {
      icpWeights: config.icpWeights,
      signalCategoryWeights: config.signalWeights,
      priorityIcpWeight: config.priorityIcpWeight,
      prioritySignalWeight: config.prioritySignalWeight,
      recencyHalfLifeDays: config.recencyHalfLifeDays,
    },
    create: {
      workspaceId,
      icpWeights: config.icpWeights,
      signalCategoryWeights: config.signalWeights,
      priorityIcpWeight: config.priorityIcpWeight,
      prioritySignalWeight: config.prioritySignalWeight,
      recencyHalfLifeDays: config.recencyHalfLifeDays,
    },
  });
}
