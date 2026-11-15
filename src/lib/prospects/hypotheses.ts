import { BUYER_ROLES } from "@/lib/icp/taxonomy";

export type BuyerRoleHypothesis = {
  role: string;
  confidence: number;
  reason: string;
};

type HypothesisSignal = {
  type: string;
  title: string;
  summary: string;
  evidence: string | null;
  confidence: number;
};

/**
 * Derive buyer-role hypotheses from the roles the user picked and public
 * evidence. These are explicitly hypotheses: we only ever name a role when the
 * ICP lists it and public text mentions the role or an adjacent alias.
 */
export function buyerRoleHypotheses(
  icpRoles: string[],
  signals: HypothesisSignal[],
): BuyerRoleHypothesis[] {
  const text = signals
    .map((signal) => `${signal.title} ${signal.summary} ${signal.evidence ?? ""}`)
    .join(" ")
    .toLowerCase();

  const hypotheses: BuyerRoleHypothesis[] = [];
  for (const role of icpRoles) {
    const taxonomy = BUYER_ROLES.find((entry) => entry.label.toLowerCase() === role.toLowerCase());
    const aliases = taxonomy ? [taxonomy.label, ...taxonomy.aliases] : [role];
    const matched = aliases.filter((alias) => alias.length >= 3 && text.includes(alias.toLowerCase()));
    if (matched.length === 0) continue;

    const relevant = signals.filter((signal) =>
      matched.some((alias) =>
        `${signal.title} ${signal.summary} ${signal.evidence ?? ""}`.toLowerCase().includes(alias.toLowerCase()),
      ),
    );
    const evidenceConfidence = relevant.length
      ? relevant.reduce((sum, signal) => sum + signal.confidence, 0) / relevant.length
      : 0;

    hypotheses.push({
      role,
      confidence: Math.max(0.35, Math.min(0.9, evidenceConfidence)),
      reason: `Public evidence mentions ${matched.slice(0, 2).join(" or ")} — a role you listed as a buyer. Treat as a hypothesis to validate in conversation, not a confirmed contact.`,
    });
  }

  // If no role is named publicly, surface the ICP's own roles as untested
  // hypotheses rather than inventing names.
  if (hypotheses.length === 0) {
    return icpRoles.slice(0, 3).map((role) => ({
      role,
      confidence: 0.2,
      reason: "No public evidence names this role yet. Listed from your ICP as an untested hypothesis.",
    }));
  }

  return hypotheses.sort((a, b) => b.confidence - a.confidence).slice(0, 4);
}
