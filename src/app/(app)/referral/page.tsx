import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { ReferralGraph } from "@/components/referral/referral-graph";
import { ensureWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import { ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReferralPage() {
  const workspace = await ensureWorkspace();

  const [contacts, relationships, companies] = await Promise.all([
    prisma.contact.findMany({
      where: { workspaceId: workspace.id },
      include: { company: { select: { id: true, name: true, domain: true, industry: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.relationship.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "desc" } }),
    prisma.company.findMany({
      where: {
        workspaceId: workspace.id,
        OR: [{ contacts: { some: {} } }, { prospects: { some: {} } }],
      },
      select: { id: true, name: true, domain: true, industry: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const serialisedContacts = contacts.map((contact) => ({
    id: contact.id,
    name: contact.name,
    email: contact.email,
    companyId: contact.companyId,
    companyName: contact.company?.name ?? contact.companyName,
    jobTitle: contact.jobTitle,
    relationshipType: contact.relationshipType,
    strength: contact.strength,
    verified: contact.verified,
    firstDegree: contact.firstDegree,
    notes: contact.notes,
  }));

  const serialisedRelationships = relationships.map((relationship) => ({
    id: relationship.id,
    fromContactId: relationship.fromContactId,
    toContactId: relationship.toContactId,
    relationshipType: relationship.relationshipType,
    strength: relationship.strength,
    verified: relationship.verified,
    source: relationship.source,
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Referral graph"
        title={<>The shortest warm route <span className="text-gradient">into a prospect.</span></>}
        description="Import contacts you already know. We run breadth-first search over the relationships you provide and show the shortest introduction path — never an inferred or scraped connection."
        actions={
          <>
            <span className="hidden items-center gap-1.5 rounded-md border border-signal-mint/20 bg-signal-mint/[0.05] px-2.5 py-1.5 text-[10px] text-signal-mint/80 sm:flex">
              <ShieldCheck className="h-3 w-3" /> Private by default
            </span>
            <Button asChild variant="outline" size="sm"><a href="/api/export/prospects">Export prospects</a></Button>
          </>
        }
      />

      <ReferralGraph
        contacts={serialisedContacts}
        relationships={serialisedRelationships}
        companies={companies}
        workspaceName={workspace.name}
      />

      {contacts.length === 0 && (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-white/[0.055] bg-white/[0.015] p-3 md:col-span-2">
            <p className="text-[11px] leading-relaxed text-muted-foreground/60">
              <span className="font-medium text-foreground/80">No graph data yet.</span> Import a CSV with <code className="font-mono text-[10px] text-signal-lime/80">name</code>,{" "}
              <code className="font-mono text-[10px] text-signal-lime/80">company</code>, <code className="font-mono text-[10px] text-signal-lime/80">knows</code> and optional relationship strength,
              or add contacts manually. Only relationships you enter are used.
            </p>
          </div>
          <div className="rounded-lg border border-white/[0.055] bg-white/[0.015] p-3 text-[10px] leading-relaxed text-muted-foreground/45">
            Shared reports never contain contacts, notes or graph data.
          </div>
        </div>
      )}

      {contacts.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[0.055] bg-white/[0.015] px-4 py-3">
          <p className="text-[10px] leading-relaxed text-muted-foreground/50">
            Privacy: the graph is stored in this workspace only. Shared reports exclude contacts, notes and referral data. Deleting a contact removes its relationships.
          </p>
        </div>
      )}
    </div>
  );
}
