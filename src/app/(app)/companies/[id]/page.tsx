import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  CircleAlert,
  Network,
  Quote,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CompanyAvatar,
  ExternalLink,
  ScoreRing,
  SignalBadge,
  Unverified,
} from "@/components/shared/display";
import { CopyButton } from "@/components/shared/copy-button";
import { ProspectQuickActions } from "@/components/companies/prospect-quick-actions";
import { CompanyNotes } from "@/components/companies/company-notes";
import { ensureWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import { signalMeta } from "@/lib/signals";
import { findIntroPaths, suggestIntroductionRequest, type GraphData } from "@/lib/graph/paths";
import { buyerRoleHypotheses } from "@/lib/prospects/hypotheses";
import type { ScoreBreakdown } from "@/lib/scoring/score";
import { formatDate, relativeTime, scoreTone, truncate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const NEXT_ACTIONS: Record<string, string> = {
  FUNDING: "New capital usually means new budget and a mandate to scale. Lead with the outcome you unlock in the first 90 days.",
  HIRING: "They are adding headcount in a function you touch. Reference the role and the operational load it creates.",
  EXPANSION: "A new market or office creates local process requirements. Ask what has to change before the team scales.",
  PRODUCT_LAUNCH: "A launch changes the go-to-market motion. Ask how they are measuring adoption and what breaks first.",
  TECHNOLOGY_CHANGE: "A stack change is a doorway. Ask what they are migrating away from and what they refuse to repeat.",
  PARTNERSHIP: "A new partnership widens distribution. Ask what the partner expects operationally in the first quarter.",
  LEADERSHIP: "A new leader often re-evaluates the status quo in their first 90 days. Congratulate and ask what they are prioritising.",
  CUSTOMER_GROWTH: "Public momentum makes internal tooling gaps more expensive. Tie your message to the next stage of growth.",
  CUSTOMER_COMPLAINT: "A public complaint names a real pain. Lead with curiosity and evidence, never with a pitch.",
};

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await ensureWorkspace();

  const [company, icp] = await Promise.all([
    prisma.company.findFirst({
      where: { id, workspaceId: workspace.id },
      include: {
        signals: { orderBy: [{ publishedAt: "desc" }, { discoveredAt: "desc" }] },
        prospects: {
          include: { icpProfile: { select: { id: true, productCategory: true, version: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.icpProfile.findFirst({
      where: { workspaceId: workspace.id, isConfirmed: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!company) notFound();

  const prospect = company.prospects.find((item) => item.icpProfileId === icp?.id) ?? company.prospects[0] ?? null;
  const rank = prospect
    ? (await prisma.prospect.count({
        where: {
          workspaceId: workspace.id,
          icpProfileId: prospect.icpProfileId,
          status: { not: "DISQUALIFIED" },
          priorityScore: { gt: prospect.priorityScore },
        },
      })) + 1
    : null;
  const breakdown = (prospect?.scoreBreakdown as unknown as ScoreBreakdown | null) ?? null;
  const roles = buyerRoleHypotheses(icp?.buyerRoles ?? [], company.signals);
  const strongSignals = [...company.signals].sort((a, b) => b.confidence - a.confidence);
  const primarySignal = strongSignals[0];

  const [contacts, relationships] = await Promise.all([
    prisma.contact.findMany({ where: { workspaceId: workspace.id } }),
    prisma.relationship.findMany({ where: { workspaceId: workspace.id } }),
  ]);

  const graph: GraphData = {
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
    companies: [{ id: company.id, name: company.name }],
  };

  const paths = prospect ? findIntroPaths(graph, company.id, { limit: 2 }) : [];
  const bestPath = paths[0] ?? null;
  const introRequest = bestPath ? suggestIntroductionRequest(bestPath, workspace.name === "My workspace" ? "me" : workspace.name) : null;
  const website = company.website && /^https?:\/\//i.test(company.website) ? company.website : company.domain ? `https://${company.domain}` : null;

  return (
    <div>
      <PageHeader
        backHref="/companies"
        backLabel="All companies"
        eyebrow={prospect && rank ? `Rank #${rank} · ${icp?.productCategory ?? "ICP"}` : "Company profile"}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <CompanyAvatar name={company.name} size={44} />
            {company.name}
            <Badge variant="outline" className="font-mono text-[9px]">LIVE</Badge>
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{company.industry ?? "Industry unverified"}</span>
            <span aria-hidden>·</span>
            <span>{company.location ?? "Location unverified"}</span>
            <span aria-hidden>·</span>
            <span>{company.employeeCount ? `${company.employeeCount.toLocaleString()} employees` : company.employeeRange ?? "Size unverified"}</span>
            {company.signals.length > 0 && (
              <>
                <span aria-hidden>·</span>
                <span>{company.signals.length} signal{company.signals.length === 1 ? "" : "s"}</span>
              </>
            )}
          </span>
        }
        actions={
          prospect ? (
            <>
              {website && (
                <Button asChild variant="outline" size="sm">
                  <a href={website} target="_blank" rel="noopener noreferrer nofollow">Website <ArrowUpRight /></a>
                </Button>
              )}
              <CopyButton
                variant="outline"
                size="sm"
                value={company.signals.map((signal) => `${signal.title} — ${signal.sourceName} — ${signal.sourceUrl}`).join("\n")}
                label="Copy evidence"
                toastMessage="All source links copied."
              />
              <ProspectQuickActions
                prospectId={prospect.id}
                companyId={company.id}
                status={prospect.status}
                sourceLinks={company.signals.map((signal) => signal.sourceUrl)}
                introRequest={introRequest}
              />
            </>
          ) : (
            website && (
              <Button asChild variant="outline" size="sm">
                <a href={website} target="_blank" rel="noopener noreferrer nofollow">Website <ArrowUpRight /></a>
              </Button>
            )
          )
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <div className="space-y-4">
          {prospect ? (
            <div className="panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="label-mono">Why this ranks here</p>
                  <p className="mt-1 max-w-lg text-[12px] leading-relaxed text-muted-foreground/65">
                    Three separate indices, visible component by component. Priority is a weighted blend — it is an ordering device, not a probability that this company will buy.
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <ScoreRing score={prospect.icpScore} label="ICP fit" size={84} />
                  <ScoreRing score={prospect.signalScore} label="Signal" size={84} />
                  <ScoreRing score={prospect.priorityScore} label="Priority" size={84} />
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-white/[0.055] bg-white/[0.018] px-3.5 py-3">
                <p className="text-[11px] leading-relaxed text-muted-foreground/65">
                  <span className="font-medium text-foreground/80">Priority formula.</span>{" "}
                  {breakdown?.priority.formula
                    ? `${breakdown.priority.formula} — ICP weight ${breakdown.priority.icpWeight}, signal weight ${breakdown.priority.signalWeight}.${breakdown.priority.capReason ? ` ${breakdown.priority.capReason}` : ""}`
                    : `Weighted blend of ICP fit ${prospect.icpScore} and signal strength ${prospect.signalScore}.`}{" "}
                  <Link href="/settings" className="text-signal-lime/80 underline-offset-2 hover:underline">Tune weights</Link>
                </p>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <div>
                  <div className="flex items-center justify-between">
                    <p className="label-mono">ICP-fit components</p>
                    <span className={cn("font-mono text-[11px]", scoreTone(prospect.icpScore))}>{prospect.icpScore}/100</span>
                  </div>
                  <div className="mt-3 space-y-3">
                    {breakdown?.icp.components.map((component) => (
                      <div key={component.key} className="rounded-lg border border-white/[0.05] p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-medium text-foreground/85">{component.label}</span>
                          <span className="font-mono text-[10px] text-muted-foreground/60">
                            {component.points}<span className="text-muted-foreground/35">/{component.max}</span>
                          </span>
                        </div>
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              component.status === "matched" ? "bg-signal-lime/75" :
                              component.status === "partial" ? "bg-signal-amber/70" :
                              component.status === "excluded" || component.status === "mismatch" ? "bg-destructive/70" : "bg-white/20",
                            )}
                            style={{ width: `${component.max > 0 ? Math.min(100, (component.points / component.max) * 100) : 0}%` }}
                          />
                        </div>
                        <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground/55">{component.reason}</p>
                        {component.status === "unknown" && <span className="mt-1 inline-block"><Unverified>estimate</Unverified></span>}
                      </div>
                    ))}
                    {!breakdown && (
                      <p className="text-[11px] text-muted-foreground/55">Component detail is unavailable for this profile. Re-run discovery to rebuild the score breakdown.</p>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <p className="label-mono">Signal contributions</p>
                    <span className={cn("font-mono text-[11px]", scoreTone(prospect.signalScore))}>{prospect.signalScore}/100</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {breakdown?.signal.contributions.slice(0, 8).map((contribution) => (
                      <div key={contribution.id} className="flex items-start gap-2.5 rounded-lg border border-white/[0.05] px-3 py-2.5">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: signalMeta(contribution.type).hex }} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-medium text-foreground/80">{contribution.label}</span>
                            <span className="font-mono text-[10px] text-muted-foreground/60">+{contribution.points}</span>
                          </div>
                          <p className="mt-0.5 text-[9px] leading-relaxed text-muted-foreground/50">{contribution.reason}</p>
                        </div>
                      </div>
                    ))}
                    {(!breakdown || breakdown.signal.contributions.length === 0) && (
                      <p className="text-[11px] leading-relaxed text-muted-foreground/55">
                        No selected signal types are present yet. The signal index stays at zero rather than inventing intent.
                      </p>
                    )}
                  </div>

                  {breakdown && (
                    <div className="mt-3 rounded-lg border border-white/[0.05] bg-white/[0.015] p-3 text-[10px] leading-relaxed text-muted-foreground/55">
                      {breakdown.signal.distinctCategories} distinct categor{breakdown.signal.distinctCategories === 1 ? "y" : "ies"}
                      {breakdown.signal.diversityBonus > 0 && ` · +${breakdown.signal.diversityBonus} diversity bonus`} · recency decay applied.
                      Repeated signals in the same category earn diminishing returns.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="panel flex items-start gap-3 p-4">
              <CircleAlert className="mt-0.5 h-4 w-4 text-signal-amber" />
              <div>
                <p className="text-[12px] font-medium">This company is not ranked in your current ICP.</p>
                <p className="mt-1 text-[11px] text-muted-foreground/60">It may exist from an older ICP or a manual import. Run discovery or refine your ICP to rank it.</p>
              </div>
            </div>
          )}

          <div className="panel">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <div>
                <p className="label-mono">Evidence timeline</p>
                <p className="mt-1 text-[12px] text-muted-foreground/65">Public signals, newest first. Every item has a source and a date.</p>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/40">{company.signals.length} items</span>
            </div>
            <div className="divide-y divide-white/[0.045]">
              {company.signals.map((signal) => {
                return (
                  <article key={signal.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <SignalBadge type={signal.type} />
                      <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/45">{signal.sourceName}</span>
                      <span className="text-muted-foreground/25">·</span>
                      <span className="text-[10px] text-muted-foreground/55">{formatDate(signal.publishedAt ?? signal.discoveredAt)}</span>
                      <span className="text-muted-foreground/25">·</span>
                      <span className="font-mono text-[9px] text-muted-foreground/45">{Math.round(signal.confidence * 100)}% conf.</span>
                    </div>
                    <h3 className="mt-2 text-[14px] font-medium leading-snug text-foreground/90">{signal.title}</h3>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground/65">{signal.summary}</p>
                    {signal.evidence && (
                      <div className="mt-2.5 flex gap-2 rounded-lg border-l-2 border-white/[0.12] bg-white/[0.015] px-3 py-2">
                        <Quote className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/35" />
                        <p className="text-[10px] italic leading-relaxed text-muted-foreground/55">“{truncate(signal.evidence, 340)}”</p>
                      </div>
                    )}
                    <div className="mt-2.5 flex flex-wrap items-center gap-3">
                      <ExternalLink href={signal.sourceUrl}>Open source</ExternalLink>
                      <span className="font-mono text-[9px] text-muted-foreground/35">discovered {relativeTime(signal.discoveredAt)}</span>
                      <CopyButton
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-[10px]"
                        value={signal.sourceUrl}
                        label="Copy link"
                        toastMessage="Source link copied."
                      />
                    </div>
                  </article>
                );
              })}
              {company.signals.length === 0 && (
                <div className="px-5 py-12 text-center">
                  <p className="text-[12px] text-muted-foreground/60">No public signals extracted for this company yet.</p>
                  <p className="mt-1 text-[10px] text-muted-foreground/40">Add a source that covers it, or run discovery with a wider period.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="panel p-5">
            <p className="label-mono">Company profile</p>
            <dl className="mt-3 space-y-2.5 text-[11px]">
              <Fact label="Industry" value={company.industry} verify={company.industryConfidence != null ? `${Math.round(company.industryConfidence * 100)}% confidence` : "source not recorded"} />
              <Fact label="Location" value={company.location} />
              <Fact
                label="Headcount"
                value={company.employeeCount ? company.employeeCount.toLocaleString() : company.employeeRange}
                verify={company.sizeSource ?? (company.employeeCount || company.employeeRange ? "source not recorded" : "not verified")}
              />
              <Fact label="Domain" value={company.domain} mono />
              <Fact label="First seen" value={formatDate(company.createdAt)} />
              <Fact label="Last scored" value={prospect ? relativeTime(prospect.lastScoredAt) : undefined} />
            </dl>
            {company.description && (
              <p className="mt-3 border-t border-white/[0.05] pt-3 text-[11px] leading-relaxed text-muted-foreground/60">{company.description}</p>
            )}
            {website && <div className="mt-3"><ExternalLink href={website}>{website.replace(/^https?:\/\//, "")}</ExternalLink></div>}
          </div>

          {prospect && (
            <div className="panel p-5">
              <div className="flex items-center justify-between">
                <p className="label-mono">Buyer-role hypotheses</p>
                <Badge variant="outline" className="font-mono text-[8px]">HYPOTHESES</Badge>
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/50">
                Derived from your ICP and public text. Never presented as confirmed contacts.
              </p>
              <div className="mt-3 space-y-2.5">
                {roles.map((role) => (
                  <div key={role.role} className="rounded-lg border border-white/[0.055] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-medium text-foreground/85">{role.role}</p>
                      <span className="font-mono text-[9px] text-muted-foreground/50">{Math.round(role.confidence * 100)}% evidence</span>
                    </div>
                    <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/55">{role.reason}</p>
                  </div>
                ))}
                {roles.length === 0 && <p className="text-[10px] text-muted-foreground/50">Add buyer roles to your ICP to see hypotheses here.</p>}
              </div>
            </div>
          )}

          {primarySignal && (
            <div className="panel p-5">
              <div className="flex items-center gap-2">
                <Target className="h-3.5 w-3.5 text-signal-lime" />
                <p className="label-mono">Suggested next action</p>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/70">
                {NEXT_ACTIONS[primarySignal.type] ?? "Open with the strongest public evidence and ask a specific question."}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground/50">
                <SignalBadge type={primarySignal.type} compact />
                <span>{relativeTime(primarySignal.publishedAt ?? primarySignal.discoveredAt)}</span>
              </div>
            </div>
          )}

          <div className="panel p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Network className="h-3.5 w-3.5 text-signal-mint" />
                <p className="label-mono">Warm introduction</p>
              </div>
              <ShieldCheck className="h-3.5 w-3.5 text-signal-mint/60" />
            </div>

            {bestPath ? (
              <div className="mt-3 space-y-3">
                <div className="space-y-2">
                  {bestPath.nodes.map((node, index) => (
                    <div key={`${node.id}-${index}`} className="flex items-start gap-2">
                      <span className={cn(
                        "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-mono text-[8px]",
                        node.type === "you" ? "border-signal-lime/30 bg-signal-lime/10 text-signal-lime" :
                        node.type === "company" ? "border-signal-violet/30 bg-signal-violet/10 text-[#c4b5fd]" :
                        "border-white/[0.1] bg-white/[0.03] text-muted-foreground/70",
                      )}>
                        {node.type === "you" ? "YOU" : index}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-foreground/85">{node.label}</p>
                        {node.type === "contact" && (node.contact.jobTitle || node.contact.verified) && (
                          <p className="text-[9px] text-muted-foreground/50">
                            {node.contact.jobTitle ?? "Role unknown"}{node.contact.verified ? " · verified" : ""}
                          </p>
                        )}
                        {node.type !== "company" && index < bestPath.nodes.length - 1 && (
                          <p className="mt-0.5 font-mono text-[8px] uppercase tracking-wider text-muted-foreground/35">
                            {bestPath.edges[index]?.label ?? "knows"}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] leading-relaxed text-muted-foreground/55">{bestPath.explanation} {bestPath.hops} hop{bestPath.hops === 1 ? "" : "s"} · weakest link {bestPath.minStrength}/5.</p>
                {introRequest && <CopyButton variant="outline" size="sm" className="w-full" value={introRequest} label="Copy intro request" toastMessage="Intro request copied." />}
                <Button asChild variant="ghost" size="sm" className="w-full text-[11px]">
                  <Link href="/referral">Open referral graph <ArrowRight /></Link>
                </Button>
              </div>
            ) : (
              <div className="mt-3">
                <p className="text-[11px] leading-relaxed text-muted-foreground/60">
                  {contacts.length === 0
                    ? "Import your contacts to find the shortest introduction route. We only use relationships you provide — never inferred ones."
                    : `No route to ${company.name} yet. Add a contact who works there, or connect existing contacts.`}
                </p>
                <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                  <Link href="/referral">{contacts.length === 0 ? "Import contacts" : "Add a relationship"} <ArrowRight /></Link>
                </Button>
              </div>
            )}
          </div>

          {prospect && (
            <div className="panel p-5">
              <p className="label-mono">Private notes</p>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/50">Only visible in this workspace. Never included in shared reports.</p>
              <div className="mt-3">
                <CompanyNotes prospectId={prospect.id} initialNotes={prospect.notes} />
              </div>
            </div>
          )}

          <div className="rounded-lg border border-white/[0.055] bg-white/[0.015] p-3 text-[10px] leading-relaxed text-muted-foreground/45">
            <Sparkles className="mb-1 h-3 w-3 text-[#c4b5fd]" />
            Signals are collected from permitted public sources only. No LinkedIn scraping, login bypass or robots evasion.
          </div>
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value, verify, mono = false }: { label: string; value?: string | null; verify?: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/[0.04] pb-2 last:border-0 last:pb-0">
      <dt className="text-muted-foreground/50">{label}</dt>
      <dd className="text-right">
        {value ? (
          <span className={cn("text-foreground/80", mono && "font-mono text-[10px]")}>{value}</span>
        ) : (
          <Unverified />
        )}
        {verify && value && <p className="mt-0.5 text-[9px] text-muted-foreground/40">{verify}</p>}
      </dd>
    </div>
  );
}
