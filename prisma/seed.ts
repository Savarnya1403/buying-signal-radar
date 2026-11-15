/**
 * Seeds a standalone demo workspace so you can explore the schema in Prisma
 * Studio without opening the app.
 *
 *   npm run db:seed
 *
 * The app itself seeds the workspace bound to your browser session when you
 * click "Load demo data". This script is for local inspection only.
 */
import { prisma } from "@/lib/db";
import { seedDemoWorkspace, DEMO_DATASET_VERSION } from "@/lib/demo/seed";

const WORKSPACE_ID = process.env.SEED_WORKSPACE_ID ?? "demo-workspace-seed01";

async function main() {
  const workspace = await prisma.workspace.upsert({
    where: { id: WORKSPACE_ID },
    update: { name: "Demo workspace" },
    create: { id: WORKSPACE_ID, name: "Demo workspace" },
  });

  const result = await seedDemoWorkspace(workspace.id, { reset: true });

  const [companies, signals, contacts, prospects] = await Promise.all([
    prisma.company.count({ where: { workspaceId: workspace.id } }),
    prisma.signal.count({ where: { workspaceId: workspace.id } }),
    prisma.contact.count({ where: { workspaceId: workspace.id } }),
    prisma.prospect.count({ where: { workspaceId: workspace.id } }),
  ]);

  console.log(`Seeded demo dataset ${DEMO_DATASET_VERSION} into workspace ${workspace.id}`);
  console.log(`  companies:  ${companies}`);
  console.log(`  signals:    ${signals}`);
  console.log(`  contacts:   ${contacts}`);
  console.log(`  prospects:  ${prospects}`);
  console.log(`  seededNow:  ${result.seeded}`);
  console.log("");
  console.log("Open the app and click 'Load demo data' to bind this dataset to your browser session.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
