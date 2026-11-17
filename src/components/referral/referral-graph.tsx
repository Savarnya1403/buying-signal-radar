"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Download,
  FileUp,
  Loader2,
  Network,
  Plus,
  Route,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CopyButton } from "@/components/shared/copy-button";
import { findIntroPaths, suggestIntroductionRequest, type GraphData, type IntroPath } from "@/lib/graph/paths";
import { contactsCsvTemplate, parseContactsCsv } from "@/lib/contacts/csv";
import { cn } from "@/lib/utils";

type Contact = {
  id: string;
  name: string;
  email: string | null;
  companyId: string | null;
  companyName: string | null;
  jobTitle: string | null;
  relationshipType: string;
  strength: number;
  verified: boolean;
  firstDegree: boolean;
  notes: string | null;
};

type Relationship = {
  id: string;
  fromContactId: string;
  toContactId: string;
  relationshipType: string;
  strength: number;
  verified: boolean;
  source: string;
};

type Company = { id: string; name: string; domain: string | null; industry: string | null };

type PersonData = {
  name: string;
  title: string | null;
  company: string | null;
  verified: boolean;
  strength: number;
  firstDegree: boolean;
  highlighted: boolean;
  dimmed: boolean;
};

type CompanyData = {
  name: string;
  industry: string | null;
  highlighted: boolean;
  dimmed: boolean;
  target: boolean;
};

type YouData = { highlighted: boolean };

type PersonNodeType = Node<PersonData, "person">;
type CompanyNodeType = Node<CompanyData, "company">;
type YouNodeType = Node<YouData, "you">;

function PersonNodeView({ data }: NodeProps<PersonNodeType>) {
  return (
    <div
      className={cn(
        "w-[188px] rounded-lg border bg-[#0b1016] px-3 py-2.5 shadow-lg transition-all",
        data.highlighted ? "border-signal-lime/60 shadow-[0_0_24px_-6px_rgba(184,242,106,0.4)]" : "border-white/[0.1]",
        data.dimmed && "opacity-35",
      )}
    >
      <Handle type="target" position={Position.Left} className="!h-1.5 !w-1.5 !border-0 !bg-white/25" />
      <Handle type="source" position={Position.Right} className="!h-1.5 !w-1.5 !border-0 !bg-white/25" />
      <div className="flex items-start gap-2">
        <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-[9px] font-medium", data.highlighted ? "border-signal-lime/30 bg-signal-lime/10 text-signal-lime" : "border-white/[0.1] bg-white/[0.03] text-muted-foreground/70")}>
          {data.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <p className="truncate text-[11px] font-medium text-foreground/90">{data.name}</p>
          </div>
          <p className="truncate text-[9px] text-muted-foreground/55">{data.title ?? "Role unknown"}</p>
          {!data.firstDegree && <p className="mt-0.5 font-mono text-[7px] uppercase tracking-wider text-signal-amber/70">Introduction target</p>}
          <div className="mt-1 flex items-center gap-1.5">
            <span className="flex items-center gap-0.5" title={`Relationship strength ${data.strength}/5`}>
              {Array.from({ length: 5 }).map((_, index) => (
                <span key={index} className={cn("h-0.5 w-1 rounded-full", index < data.strength ? "bg-signal-mint/70" : "bg-white/10")} />
              ))}
            </span>
            {data.verified && <CheckCircle2 className="h-2.5 w-2.5 text-signal-mint/70" />}
          </div>
        </div>
      </div>
    </div>
  );
}

function CompanyNodeView({ data }: NodeProps<CompanyNodeType>) {
  return (
    <div
      className={cn(
        "w-[188px] rounded-lg border px-3 py-2 transition-all",
        data.target ? "border-[#a78bfa]/50 bg-[#a78bfa]/[0.08]" : "border-white/[0.08] bg-[#0d1218]",
        data.highlighted && !data.target && "border-signal-violet/40",
        data.dimmed && "opacity-35",
      )}
    >
      <Handle type="target" position={Position.Left} className="!h-1.5 !w-1.5 !border-0 !bg-white/25" />
      <div className="flex items-center gap-2">
        <Building2 className={cn("h-3.5 w-3.5 shrink-0", data.target ? "text-[#c4b5fd]" : "text-muted-foreground/50")} />
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium text-foreground/85">{data.name}</p>
          <p className="truncate text-[8px] uppercase tracking-wider text-muted-foreground/40">{data.industry ?? "Industry unknown"}</p>
        </div>
      </div>
    </div>
  );
}

function YouNodeView({ data }: NodeProps<YouNodeType>) {
  return (
    <div className={cn("flex w-[92px] items-center justify-center gap-1.5 rounded-full border border-signal-lime/35 bg-signal-lime/[0.08] px-3 py-2 text-signal-lime shadow-[0_0_20px_-6px_rgba(184,242,106,0.4)]", data.highlighted && "ring-1 ring-signal-lime/30")}>
      <Handle type="source" position={Position.Right} className="!h-1.5 !w-1.5 !border-0 !bg-signal-lime/50" />
      <UserRound className="h-3 w-3" />
      <span className="font-mono text-[9px] uppercase tracking-wider">You</span>
    </div>
  );
}

const nodeTypes = { person: PersonNodeView, company: CompanyNodeView, you: YouNodeView };

const pair = (a: string, b: string) => [a, b].sort().join("|");

export function ReferralGraph({
  contacts,
  relationships,
  companies,
  workspaceName,
}: {
  contacts: Contact[];
  relationships: Relationship[];
  companies: Company[];
  workspaceName: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [targetCompanyId, setTargetCompanyId] = useState<string>("");
  const [activePathIndex, setActivePathIndex] = useState(0);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [showYou, setShowYou] = useState(true);

  const graphData: GraphData = useMemo(
    () => ({
      contacts: contacts.map((contact) => ({
        id: contact.id,
        name: contact.name,
        companyId: contact.companyId,
        companyName: contact.companyName,
        jobTitle: contact.jobTitle,
        verified: contact.verified,
        strength: contact.strength,
        firstDegree: contact.firstDegree,
        relationshipType: contact.relationshipType,
      })),
      relationships: relationships.map((relationship) => ({
        id: relationship.id,
        fromContactId: relationship.fromContactId,
        toContactId: relationship.toContactId,
        relationshipType: relationship.relationshipType,
        strength: relationship.strength,
        verified: relationship.verified,
      })),
      companies,
    }),
    [contacts, relationships, companies],
  );

  const paths: IntroPath[] = useMemo(() => {
    if (!targetCompanyId) return [];
    return findIntroPaths(graphData, targetCompanyId, { verifiedOnly, limit: 3 });
  }, [graphData, targetCompanyId, verifiedOnly]);

  const activePath = paths[Math.min(activePathIndex, Math.max(0, paths.length - 1))] ?? null;
  const pathNodeIds = useMemo(() => new Set(activePath?.nodes.map((node) => node.id) ?? []), [activePath]);
  const pathPairs = useMemo(() => new Set(activePath?.edges.map((edge) => pair(edge.from, edge.to)) ?? []), [activePath]);
  const hasPath = Boolean(activePath);

  const groups = useMemo(() => {
    const map = new Map<string, { id: string; name: string; industry: string | null; contacts: Contact[] }>();
    for (const contact of contacts) {
      const company = companies.find((item) => item.id === contact.companyId);
      const key = contact.companyId ?? "independent";
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          name: company?.name ?? contact.companyName ?? "Independent contacts",
          industry: company?.industry ?? null,
          contacts: [],
        });
      }
      map.get(key)!.contacts.push(contact);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [contacts, companies]);

  const { nodes, edges } = useMemo(() => {
    const nextNodes: Node[] = [];
    const nextEdges: Edge[] = [];
    const maxContacts = Math.max(1, ...groups.map((group) => group.contacts.length));
    const midY = 30 + (maxContacts * 96) / 2;

    if (showYou) {
      nextNodes.push({
        id: "you",
        type: "you",
        position: { x: -170, y: midY },
        data: { highlighted: hasPath },
        draggable: false,
      });
    }

    groups.forEach((group, groupIndex) => {
      const x = groupIndex * 270;
      const isTargetCompany = targetCompanyId === group.id;
      const companyInPath = pathNodeIds.has(group.id);
      nextNodes.push({
        id: `company-${group.id}`,
        type: "company",
        position: { x, y: 0 },
        data: {
          name: group.name,
          industry: group.industry,
          highlighted: companyInPath,
          dimmed: hasPath && !companyInPath,
          target: isTargetCompany,
        } satisfies CompanyData,
        draggable: false,
      });

      group.contacts.forEach((contact, contactIndex) => {
        const inPath = pathNodeIds.has(contact.id);
        nextNodes.push({
          id: contact.id,
          type: "person",
          position: { x, y: 74 + contactIndex * 96 },
          data: {
            name: contact.name,
            title: contact.jobTitle,
            company: group.name,
            verified: contact.verified,
            strength: contact.strength,
            firstDegree: contact.firstDegree,
            highlighted: inPath,
            dimmed: hasPath && !inPath,
          } satisfies PersonData,
          draggable: false,
        });

        nextEdges.push({
          id: `works-${contact.id}`,
          source: contact.id,
          target: `company-${group.id}`,
          type: "smoothstep",
          style: { stroke: inPath ? "rgba(167,139,250,0.65)" : "rgba(255,255,255,0.12)", strokeDasharray: "3 4" },
          animated: inPath,
        });

        if (showYou && contact.firstDegree) {
          const inPathEdge = pathPairs.has(pair("you", contact.id));
          nextEdges.push({
            id: `you-${contact.id}`,
            source: "you",
            target: contact.id,
            type: "smoothstep",
            style: { stroke: inPathEdge ? "#b8f26a" : "rgba(255,255,255,0.08)" },
            animated: inPathEdge,
          });
        }
      });
    });

    for (const relationship of relationships) {
      const inPath = pathPairs.has(pair(relationship.fromContactId, relationship.toContactId));
      nextEdges.push({
        id: `rel-${relationship.id}`,
        source: relationship.fromContactId,
        target: relationship.toContactId,
        type: "straight",
        label: inPath ? relationship.relationshipType : undefined,
        labelStyle: { fill: "#c7f99a", fontSize: 8, fontFamily: "var(--font-geist-mono)" },
        labelBgStyle: { fill: "#0b1016", fillOpacity: 0.9 },
        markerEnd: { type: MarkerType.ArrowClosed, color: inPath ? "#b8f26a" : "rgba(255,255,255,0.25)", width: 12, height: 12 },
        style: {
          stroke: inPath ? "#b8f26a" : relationship.verified ? "rgba(94,234,212,0.4)" : "rgba(255,255,255,0.18)",
          strokeWidth: inPath ? 2 : 1,
          strokeDasharray: relationship.verified ? undefined : "5 4",
          opacity: hasPath && !inPath ? 0.3 : 1,
        },
        animated: inPath,
      });
    }

    return { nodes: nextNodes, edges: nextEdges };
  }, [groups, relationships, targetCompanyId, pathNodeIds, pathPairs, hasPath, showYou]);

  const contactById = useMemo(() => new Map(contacts.map((contact) => [contact.id, contact])), [contacts]);
  const introRequest = activePath ? suggestIntroductionRequest(activePath, workspaceName === "My workspace" ? "me" : workspaceName) : "";

  const copyPathSummary = activePath
    ? activePath.nodes.map((node) => node.label).join(" → ")
    : "";

  return (
    <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
      <div className="space-y-3">
        <div className="panel overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-3 py-2.5">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/50">
                <Network className="h-3 w-3" /> {contacts.length} contacts · {relationships.length} links
              </span>
            </div>
            <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
              <Switch checked={verifiedOnly} onCheckedChange={setVerifiedOnly} className="h-4 w-7 [&>span]:h-3 [&>span]:w-3 [&[data-state=checked]>span]:translate-x-3" />
              Verified only
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
              <Switch checked={showYou} onCheckedChange={setShowYou} className="h-4 w-7 [&>span]:h-3 [&>span]:w-3 [&[data-state=checked]>span]:translate-x-3" />
              Show &ldquo;You&rdquo;
            </label>
          </div>

          {contacts.length === 0 ? (
            <div className="flex h-[520px] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-signal-mint">
                <Network className="h-5 w-5" />
              </div>
              <p className="mt-3 text-[14px] font-medium">Your graph starts with people you already know.</p>
              <p className="mt-1 max-w-sm text-[11px] leading-relaxed text-muted-foreground/60">
                Import a CSV or add a contact manually. We only draw relationships you provide — never inferred connections.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <ImportDialog onDone={() => startTransition(() => router.refresh())} />
                <AddContactDialog onDone={() => startTransition(() => router.refresh())} />
              </div>
            </div>
          ) : (
            <div className="h-[560px] w-full bg-[radial-gradient(ellipse_at_50%_0%,rgba(94,234,212,0.05),transparent_60%)]">
              <ReactFlow
                key={`${contacts.length}-${relationships.length}`}
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.18, maxZoom: 1.1 }}
                minZoom={0.35}
                maxZoom={1.6}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                panOnScroll
                proOptions={{ hideAttribution: true }}
              >
                <Background color="rgba(255,255,255,0.05)" gap={26} size={1} />
                <Controls showInteractive={false} />
                <MiniMap
                  pannable
                  zoomable
                  nodeColor={(node) => (node.type === "you" ? "#b8f26a" : node.type === "company" ? "#a78bfa" : "#5eead4")}
                  maskColor="rgba(7,9,12,0.75)"
                />
              </ReactFlow>
            </div>
          )}
        </div>

        <div className="panel p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label className="text-[11px]">Find the shortest introduction path to…</Label>
              <Select
                value={targetCompanyId}
                onValueChange={(value) => {
                  setTargetCompanyId(value);
                  setActivePathIndex(0);
                }}
              >
                <SelectTrigger className="mt-1.5 h-9">
                  <SelectValue placeholder="Choose a company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}{company.industry ? ` · ${company.industry}` : ""}
                    </SelectItem>
                  ))}
                  {companies.length === 0 && <SelectItem value="none" disabled>No companies yet</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <ImportDialog onDone={() => startTransition(() => router.refresh())} />
              <AddContactDialog onDone={() => startTransition(() => router.refresh())} />
              <AddRelationshipDialog contacts={contacts} onDone={() => startTransition(() => router.refresh())} />
            </div>
          </div>

          {targetCompanyId && (
            <div className="mt-4 border-t border-white/[0.055] pt-4">
              {activePath ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-[12px] font-medium text-signal-lime">
                      <Route className="h-3.5 w-3.5" /> Shortest route found
                    </p>
                    <div className="flex items-center gap-1">
                      {paths.map((path, index) => (
                        <button
                          key={index}
                          onClick={() => setActivePathIndex(index)}
                          className={cn(
                            "rounded border px-2 py-0.5 font-mono text-[9px] transition-colors",
                            index === activePathIndex ? "border-signal-lime/40 bg-signal-lime/10 text-signal-lime" : "border-white/[0.08] text-muted-foreground/50 hover:text-foreground",
                          )}
                        >
                          Path {index + 1} · {path.hops} hop{path.hops === 1 ? "" : "s"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    {activePath.nodes.map((node, index) => (
                      <span key={`${node.id}-${index}`} className="flex items-center gap-1.5">
                        {index > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground/30" />}
                        <span className={cn(
                          "rounded-md border px-2 py-1",
                          node.type === "you" ? "border-signal-lime/25 bg-signal-lime/[0.07] text-signal-lime" :
                          node.type === "company" ? "border-[#a78bfa]/25 bg-[#a78bfa]/[0.07] text-[#c4b5fd]" :
                          "border-white/[0.09] bg-white/[0.03] text-foreground/80",
                        )}>
                          {node.label}
                        </span>
                      </span>
                    ))}
                  </div>

                  <p className="text-[11px] leading-relaxed text-muted-foreground/60">{activePath.explanation}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <CopyButton size="sm" variant="outline" value={introRequest} label="Copy intro request" toastMessage="Intro request copied." />
                    <CopyButton size="sm" variant="ghost" value={copyPathSummary} label="Copy route" toastMessage="Route copied." />
                    <span className="ml-auto flex items-center gap-2 text-[9px] text-muted-foreground/45">
                      <span className="h-1.5 w-1.5 rounded-full bg-signal-mint" /> verified
                      <span className="h-1.5 w-1.5 rounded-full bg-white/25" /> unverified
                      <span>{activePath.verifiedEdges}/{activePath.edges.length} verified edges</span>
                    </span>
                  </div>

                  {activePath.introductions > 0 && (
                    <div className="rounded-lg border border-signal-amber/15 bg-signal-amber/[0.04] p-2.5 text-[10px] leading-relaxed text-signal-amber/75">
                      A warm introduction is a favour. Ask the connector first, explain why the target specifically, and make forwarding easy.
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] px-3 py-4">
                  <p className="text-[11px] font-medium text-foreground/75">No route to this company yet.</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/55">
                    {verifiedOnly
                      ? "No fully verified route exists. Turn off “verified only” to include unverified relationships you entered."
                      : "Add a contact who works there, or connect existing contacts. We never invent a connection to fill the gap."}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="panel p-4">
          <div className="flex items-center justify-between">
            <p className="label-mono">Graph coverage</p>
            <Badge variant="outline" className="font-mono text-[8px]">PRIVATE</Badge>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat label="Contacts" value={contacts.length} icon={<Users className="h-3 w-3" />} />
            <Stat label="Relationships" value={relationships.length} icon={<Network className="h-3 w-3" />} />
            <Stat label="Companies" value={groups.filter((group) => group.id !== "independent").length} icon={<Building2 className="h-3 w-3" />} />
            <Stat label="Verified links" value={relationships.filter((relationship) => relationship.verified).length} icon={<ShieldCheck className="h-3 w-3" />} />
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground/45">
            Breadth-first search over undirected relationships. At equal depth, verified and stronger links are preferred.
          </p>
        </div>

        <div className="panel">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <p className="label-mono">People</p>
            <div className="flex items-center gap-1">
              <AddContactDialog
                onDone={() => startTransition(() => router.refresh())}
                trigger={<Button variant="ghost" size="icon-sm" aria-label="Add contact"><Plus className="h-3.5 w-3.5" /></Button>}
              />
            </div>
          </div>
          <div className="max-h-[330px] divide-y divide-white/[0.04] overflow-y-auto">
            {contacts.map((contact) => (
              <div key={contact.id} className="group flex items-center gap-2.5 px-4 py-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/[0.09] bg-white/[0.03] font-mono text-[8px] text-muted-foreground/70">
                  {contact.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <p className="truncate text-[11px] font-medium text-foreground/85">{contact.name}</p>
                    {contact.verified && <ShieldCheck className="h-2.5 w-2.5 shrink-0 text-signal-mint/60" />}
                  </div>
                  <p className="truncate text-[9px] text-muted-foreground/50">{contact.jobTitle ?? "Role unknown"}{contact.companyName ? ` · ${contact.companyName}` : ""}</p>
                  {!contact.firstDegree && <p className="font-mono text-[7px] uppercase tracking-wider text-signal-amber/70">Introduction target</p>}
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${contact.name}`}
                  onClick={async () => {
                    if (!window.confirm(`Remove ${contact.name} and all their relationships from this workspace?`)) return;
                    const response = await fetch(`/api/contacts/${contact.id}`, { method: "DELETE" });
                    if (response.ok) {
                      toast.success(`${contact.name} removed.`);
                      startTransition(() => router.refresh());
                    } else {
                      toast.error("Could not remove that contact.");
                    }
                  }}
                  className="rounded p-1 text-muted-foreground/25 opacity-0 transition-all hover:bg-destructive/10 hover:text-[#ff9cac] group-hover:opacity-100"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            {contacts.length === 0 && <p className="px-4 py-6 text-center text-[10px] text-muted-foreground/45">No contacts yet.</p>}
          </div>
        </div>

        <div className="panel">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <p className="label-mono">Relationships</p>
            <span className="font-mono text-[9px] text-muted-foreground/40">{relationships.length}</span>
          </div>
          <div className="max-h-[270px] divide-y divide-white/[0.04] overflow-y-auto">
            {relationships.map((relationship) => {
              const from = contactById.get(relationship.fromContactId);
              const to = contactById.get(relationship.toContactId);
              if (!from || !to) return null;
              return (
                <div key={relationship.id} className="group flex items-center gap-2 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] text-foreground/75">
                      {from.name} <span className="text-muted-foreground/35">↔</span> {to.name}
                    </p>
                    <p className="truncate text-[9px] text-muted-foreground/45">
                      {relationship.relationshipType} · {relationship.strength}/5 · {relationship.verified ? "verified" : relationship.source.toLowerCase()}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Remove relationship"
                    onClick={async () => {
                      const response = await fetch(`/api/relationships?id=${relationship.id}`, { method: "DELETE" });
                      if (response.ok) {
                        toast.success("Relationship removed.");
                        startTransition(() => router.refresh());
                      } else {
                        toast.error("Could not remove that relationship.");
                      }
                    }}
                    className="rounded p-1 text-muted-foreground/25 opacity-0 transition-all hover:bg-destructive/10 hover:text-[#ff9cac] group-hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
            {relationships.length === 0 && <p className="px-4 py-6 text-center text-[10px] text-muted-foreground/45">No relationships yet.</p>}
          </div>
        </div>

        <div className="rounded-lg border border-white/[0.055] bg-white/[0.015] p-3 text-[10px] leading-relaxed text-muted-foreground/45">
          <Sparkles className="mb-1 h-3 w-3 text-[#c4b5fd]" />
          Manual and CSV contacts stay in this workspace. We do not enrich, scrape or guess email addresses.
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/[0.055] bg-white/[0.018] p-2.5">
      <div className="flex items-center gap-1.5 text-muted-foreground/40">{icon}<span className="font-mono text-[8px] uppercase tracking-wider">{label}</span></div>
      <p className="mt-1 font-mono text-[17px] tabular-nums text-foreground/85">{value}</p>
    </div>
  );
}

function AddContactDialog({ onDone, trigger }: { onDone: () => void; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    companyName: "",
    jobTitle: "",
    relationshipType: "Professional",
    strength: 3,
    verified: false,
    firstDegree: true,
    notes: "",
    linkedinUrl: "",
  });

  const submit = async () => {
    if (!form.name.trim()) {
      toast.error("A name is required.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, email: form.email || undefined }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Could not add that contact.");
      }
      toast.success(`${form.name} added.`);
      setOpen(false);
      setForm({ name: "", email: "", companyName: "", jobTitle: "", relationshipType: "Professional", strength: 3, verified: false, firstDegree: true, notes: "", linkedinUrl: "" });
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="outline" size="sm"><Plus /> Add contact</Button>}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a contact</DialogTitle>
          <DialogDescription>Only add people you actually know. Nothing is enriched or guessed.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name *"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Alex Morgan" /></Field>
          <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="alex@company.com" type="email" /></Field>
          <Field label="Company"><Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} placeholder="Northwind Labs" /></Field>
          <Field label="Job title"><Input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} placeholder="VP Sales" /></Field>
          <Field label="Relationship"><Input value={form.relationshipType} onChange={(e) => setForm({ ...form, relationshipType: e.target.value })} placeholder="Former colleague" /></Field>
          <Field label="Strength (1–5)">
            <Select value={String(form.strength)} onValueChange={(value) => setForm({ ...form, strength: Number(value) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((value) => <SelectItem key={value} value={String(value)}>{value} — {value >= 4 ? "strong" : value === 3 ? "warm" : "loose"}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Context that helps you ask for an introduction later." className="min-h-[70px]" /></Field>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-muted-foreground/70 sm:col-span-2">
            <Switch checked={form.verified} onCheckedChange={(value) => setForm({ ...form, verified: value })} /> I have verified this relationship directly
          </label>
          <label className="flex items-start gap-2 text-[11px] text-muted-foreground/70 sm:col-span-2">
            <Switch checked={form.firstDegree} onCheckedChange={(value) => setForm({ ...form, firstDegree: value })} className="mt-0.5" />
            <span>
              I know this person directly
              <span className="mt-0.5 block text-[9px] leading-relaxed text-muted-foreground/45">
                Turn off if this person is an introduction target at a company, not someone you can contact directly. Path-finding will route to them through connectors.
              </span>
            </span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus />} Add contact</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddRelationshipDialog({ contacts, onDone }: { contacts: Contact[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ fromContactId: "", toContactId: "", relationshipType: "Knows", strength: 3, verified: false });

  const submit = async () => {
    if (!form.fromContactId || !form.toContactId) {
      toast.error("Choose two contacts.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/relationships", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Could not add that relationship.");
      }
      toast.success("Relationship added.");
      setOpen(false);
      setForm({ fromContactId: "", toContactId: "", relationshipType: "Knows", strength: 3, verified: false });
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={contacts.length < 2} title={contacts.length < 2 ? "Add at least two contacts first" : undefined}>
          <Network /> Add link
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect two contacts</DialogTitle>
          <DialogDescription>Relationships are undirected for path-finding. Only add a connection you can stand behind.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Contact A">
            <Select value={form.fromContactId} onValueChange={(value) => setForm({ ...form, fromContactId: value })}>
              <SelectTrigger><SelectValue placeholder="Choose a contact" /></SelectTrigger>
              <SelectContent>{contacts.map((contact) => <SelectItem key={contact.id} value={contact.id}>{contact.name}{contact.companyName ? ` · ${contact.companyName}` : ""}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Contact B">
            <Select value={form.toContactId} onValueChange={(value) => setForm({ ...form, toContactId: value })}>
              <SelectTrigger><SelectValue placeholder="Choose a contact" /></SelectTrigger>
              <SelectContent>{contacts.filter((contact) => contact.id !== form.fromContactId).map((contact) => <SelectItem key={contact.id} value={contact.id}>{contact.name}{contact.companyName ? ` · ${contact.companyName}` : ""}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="How they know each other"><Input value={form.relationshipType} onChange={(e) => setForm({ ...form, relationshipType: e.target.value })} placeholder="Former colleague" /></Field>
            <Field label="Strength (1–5)">
              <Select value={String(form.strength)} onValueChange={(value) => setForm({ ...form, strength: Number(value) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[1, 2, 3, 4, 5].map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-muted-foreground/70">
            <Switch checked={form.verified} onCheckedChange={(value) => setForm({ ...form, verified: value })} /> Verified relationship
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Network />} Add relationship</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const parsed = useMemo(() => (csv.trim().length > 0 ? parseContactsCsv(csv) : null), [csv]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2_000_000) {
      toast.error("CSV is larger than 2 MB.");
      return;
    }
    setFileName(file.name);
    setCsv(await file.text());
  };

  const downloadTemplate = () => {
    const blob = new Blob([contactsCsvTemplate()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "buying-signal-radar-contacts-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const submit = async () => {
    if (!parsed || parsed.rows.length === 0) {
      toast.error("Add a CSV with at least one valid contact.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/contacts/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message ?? "Import failed.");
      toast.success(`${body.imported} contact${body.imported === 1 ? "" : "s"} imported${body.relationshipsCreated ? `, ${body.relationshipsCreated} relationships created` : ""}.`);
      setOpen(false);
      setCsv("");
      setFileName("");
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><FileUp /> Import CSV</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import contacts</DialogTitle>
          <DialogDescription>
            Recognised columns: name, email, company, job_title, relationship_type, relationship_strength, verified, first_degree, notes, linkedin_url, knows.
            Duplicates are skipped. Emails are matched to companies only inside this workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-dashed border-white/[0.12] bg-white/[0.015] p-4">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => onFile(event.target.files?.[0])}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload /> Choose CSV</Button>
            <Button variant="ghost" size="sm" onClick={downloadTemplate}><Download /> Download template</Button>
            {fileName && <span className="truncate font-mono text-[10px] text-muted-foreground/60">{fileName}</span>}
          </div>
          {parsed ? (
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap gap-2 text-[10px]">
                <span className="rounded border border-signal-lime/20 bg-signal-lime/[0.06] px-2 py-0.5 text-signal-lime">{parsed.rows.length} valid rows</span>
                <span className="rounded border border-white/[0.08] px-2 py-0.5 text-muted-foreground/60">{parsed.headers.length} columns detected</span>
                {parsed.errors.length > 0 && <span className="rounded border border-signal-amber/20 bg-signal-amber/[0.06] px-2 py-0.5 text-signal-amber">{parsed.errors.length} warning{parsed.errors.length === 1 ? "" : "s"}</span>}
              </div>
              <div className="max-h-[180px] overflow-auto rounded border border-white/[0.06]">
                <table className="w-full text-left text-[10px]">
                  <thead className="sticky top-0 bg-[#0d1218] text-muted-foreground/50">
                    <tr><th className="px-2 py-1.5 font-medium">Name</th><th className="px-2 py-1.5 font-medium">Company</th><th className="px-2 py-1.5 font-medium">Role</th><th className="px-2 py-1.5 font-medium">Knows</th></tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {parsed.rows.slice(0, 30).map((row, index) => (
                      <tr key={index}><td className="px-2 py-1.5 text-foreground/80">{row.name}</td><td className="px-2 py-1.5 text-muted-foreground/60">{row.company || "—"}</td><td className="px-2 py-1.5 text-muted-foreground/60">{row.jobTitle || "—"}</td><td className="px-2 py-1.5 text-muted-foreground/60">{row.knows || "—"}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsed.errors.length > 0 && (
                <div className="max-h-[80px] space-y-1 overflow-auto text-[9px] text-signal-amber/70">
                  {parsed.errors.slice(0, 6).map((error, index) => <p key={index}>Row {error.row}: {error.message}</p>)}
                </div>
              )}
            </div>
          ) : (
            <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground/45">
              Prefer starting from the template. The <span className="font-mono text-foreground/60">knows</span> column accepts names or emails separated by <span className="font-mono">;</span>.
            </p>
          )}
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-white/[0.055] bg-white/[0.015] px-3 py-2 text-[10px] leading-relaxed text-muted-foreground/55">
          <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-signal-mint/60" />
          Nothing is uploaded anywhere except this app&apos;s database. Never present an imported relationship as verified unless you have confirmed it.
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !parsed || parsed.rows.length === 0}>
            {saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            Import {parsed?.rows.length ? `${parsed.rows.length} contact${parsed.rows.length === 1 ? "" : "s"}` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px]">{label}</Label>
      {children}
    </div>
  );
}
