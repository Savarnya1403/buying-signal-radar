import type { SignalType } from "@prisma/client";
import { GEOGRAPHIES, INDUSTRIES, regionCovers, TRIGGER_TO_SIGNAL } from "@/lib/icp/taxonomy";
import { SIGNAL_META } from "@/lib/signals";
import { DEFAULT_SCORING_CONFIG, type ScoringConfig } from "./config";

export type ScoringIcp = {
  targetIndustries: string[];
  geographies: string[];
  companySizeMin: number | null;
  companySizeMax: number | null;
  buyerRoles: string[];
  painPoints: string[];
  buyingTriggers: string[];
  exclusions: string[];
  selectedSignalTypes: string[];
};

export type ScoringCompany = {
  name: string;
  industry: string | null;
  location: string | null;
  employeeCount: number | null;
  employeeRange: string | null;
  description: string | null;
};

export type ScoringSignal = {
  id: string;
  type: SignalType;
  title: string;
  summary: string;
  evidence: string | null;
  confidence: number;
  publishedAt: Date | null;
  discoveredAt: Date;
  sourceUrl: string;
  sourceName: string;
};

export type ScoreComponent = {
  key: string;
  label: string;
  points: number;
  max: number;
  status: "matched" | "partial" | "unknown" | "mismatch" | "excluded";
  reason: string;
};

export type SignalContribution = {
  id: string;
  type: SignalType;
  label: string;
  points: number;
  confidence: number;
  recencyDays: number;
  reason: string;
};

export type ScoreBreakdown = {
  icp: {
    total: number;
    components: ScoreComponent[];
    excluded: boolean;
    explanation: string;
  };
  signal: {
    total: number;
    contributions: SignalContribution[];
    distinctCategories: number;
    diversityBonus: number;
    explanation: string;
  };
  priority: {
    total: number;
    uncappedTotal: number;
    icpWeight: number;
    signalWeight: number;
    signalFitMultiplier: number;
    cap: number | null;
    capReason: string | null;
    formula: string;
  };
  configVersion: "default-v1";
  scoredAt: string;
};

export type ScoreResult = {
  icpScore: number;
  signalScore: number;
  priorityScore: number;
  breakdown: ScoreBreakdown;
};

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "their", "they", "will", "have", "has", "are", "was", "were",
  "into", "over", "under", "more", "less", "than", "about", "your", "our", "its", "can", "not", "but", "all", "any",
  "new", "who", "how", "why", "when", "where", "what", "public", "company", "companies", "business", "businesses",
  "product", "products", "platform", "software", "service", "services", "team", "teams", "customer", "customers",
  "help", "helps", "using", "used", "use", "based", "early", "stage", "large", "small",
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s+#.-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function points(value: number) {
  return Math.round(value * 10) / 10;
}

export function industryMatches(target: string, actual: string | null): boolean {
  if (!actual) return false;
  const targetLower = target.toLowerCase();
  const actualLower = actual.toLowerCase();
  if (targetLower === actualLower) return true;
  if (targetLower.includes(actualLower) || actualLower.includes(targetLower)) return true;

  const taxonomy = INDUSTRIES.find((entry) => entry.label.toLowerCase() === targetLower);
  if (taxonomy?.aliases.some((alias) => actualLower.includes(alias))) return true;
  const actualTaxonomy = INDUSTRIES.find((entry) => entry.label.toLowerCase() === actualLower);
  if (actualTaxonomy?.aliases.some((alias) => targetLower.includes(alias))) return true;

  const a = new Set(tokens(target));
  const b = tokens(actual);
  const overlap = b.filter((token) => a.has(token));
  return overlap.length > 0 && overlap.some((token) => token.length >= 4);
}

export function locationMatches(geography: string, location: string | null): boolean {
  if (!location) return false;
  if (geography === "Remote / global") return true;
  const lower = location.toLowerCase();
  const geo = GEOGRAPHIES.find((entry) => entry.label.toLowerCase() === geography.toLowerCase());
  if (!geo) return lower.includes(geography.toLowerCase());
  if (lower.includes(geo.label.toLowerCase())) return true;
  const locationGeography = GEOGRAPHIES.find((entry) => lower.includes(entry.label.toLowerCase()))?.label;
  if (locationGeography && (regionCovers(geo.label, locationGeography) || regionCovers(locationGeography, geo.label))) {
    return true;
  }
  return geo.aliases.some((alias) => {
    const pattern = new RegExp(`(?<![a-z0-9])${alias.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`, "i");
    return pattern.test(lower);
  }) || lower.includes(geography.toLowerCase());
}

export function parseEmployeeRange(range: string | null): { min: number | null; max: number | null } {
  if (!range) return { min: null, max: null };
  const normalized = range.replace(/,/g, "");
  const numbers = normalized.match(/\d+/g)?.map(Number) ?? [];
  if (numbers.length >= 2) return { min: Math.min(...numbers.slice(0, 2)), max: Math.max(...numbers.slice(0, 2)) };
  if (numbers.length === 1) {
    if (/\+/.test(range)) return { min: numbers[0], max: null };
    if (/(under|below|less than|up to)/i.test(range)) return { min: null, max: numbers[0] };
    return { min: numbers[0], max: numbers[0] };
  }
  return { min: null, max: null };
}

function sizeFit(icp: ScoringIcp, company: ScoringCompany, maxPoints: number): ScoreComponent {
  const companySize = company.employeeCount ?? null;
  const range = parseEmployeeRange(company.employeeRange);
  const min = companySize ?? range.min;
  const max = companySize ?? range.max;

  if (!icp.companySizeMin && !icp.companySizeMax) {
    return {
      key: "size",
      label: "Company size",
      points: points(maxPoints * 0.7),
      max: maxPoints,
      status: "unknown",
      reason: "You did not set a size range, so we do not penalise size.",
    };
  }

  if (min == null && max == null) {
    return {
      key: "size",
      label: "Company size",
      points: points(maxPoints * 0.2),
      max: maxPoints,
      status: "unknown",
      reason: "Headcount is not verified for this company. Small neutral credit only — marked as unverified.",
    };
  }

  const icpMin = icp.companySizeMin ?? 1;
  const icpMax = icp.companySizeMax ?? Number.POSITIVE_INFINITY;
  const fits = (min ?? 0) >= icpMin && (max ?? Number.POSITIVE_INFINITY) <= icpMax;
  if (fits) {
    return {
      key: "size",
      label: "Company size",
      points: maxPoints,
      max: maxPoints,
      status: "matched",
      reason: `${company.employeeCount?.toLocaleString() ?? company.employeeRange} employees is inside your ${icpMin.toLocaleString()}–${Number.isFinite(icpMax) ? icpMax.toLocaleString() : "∞"} range.`,
    };
  }

  const distance = (min ?? 0) < icpMin ? icpMin - (min ?? 0) : (min ?? 0) - icpMax;
  const near = distance <= Math.max(20, (Number.isFinite(icpMax) ? icpMax : icpMin) * 0.25);
  return {
    key: "size",
    label: "Company size",
    points: points(near ? maxPoints * 0.5 : 0),
    max: maxPoints,
    status: near ? "partial" : "matched",
    reason: near
      ? `Slightly outside the target range (${company.employeeCount?.toLocaleString() ?? company.employeeRange} employees). Partial credit.`
      : `Outside the target range (${company.employeeCount?.toLocaleString() ?? company.employeeRange} employees).`,
  };
}

function exclusionHit(icp: ScoringIcp, company: ScoringCompany): string | null {
  if (!icp.exclusions.length) return null;
  const fields = [company.name, company.industry, company.location, company.description, company.employeeRange]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  for (const exclusion of icp.exclusions) {
    const words = tokens(exclusion).filter((word) => !/^\d+$/.test(word));
    if (words.length === 0) continue;
    const hits = words.filter((word) => fields.includes(word));
    if (hits.length >= Math.min(2, words.length)) return exclusion;

    const sizeMatch = exclusion.match(/(?:over|above|more than|at least)\s*([\d,]+)/i);
    if (sizeMatch && company.employeeCount) {
      const threshold = Number(sizeMatch[1].replace(/,/g, ""));
      if (company.employeeCount > threshold) return exclusion;
    }
    const underMatch = exclusion.match(/(?:under|below|less than|fewer than)\s*([\d,]+)/i);
    if (underMatch && company.employeeCount) {
      const threshold = Number(underMatch[1].replace(/,/g, ""));
      if (company.employeeCount < threshold) return exclusion;
    }
  }
  return null;
}

function matchPain(text: string, pains: string[]): string | null {
  if (!pains.length || !text) return null;
  const haystack = text.toLowerCase();
  for (const pain of pains) {
    const words = tokens(pain);
    if (words.length === 0) continue;
    const hits = words.filter((word) => haystack.includes(word));
    if (hits.length >= Math.max(1, Math.ceil(words.length * 0.5))) return pain;
  }
  return null;
}

export function scoreProspect(
  icp: ScoringIcp,
  company: ScoringCompany,
  signals: ScoringSignal[],
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
  now: Date = new Date(),
): ScoreResult {
  const weights = config.icpWeights;
  const totalIcpWeight = Object.values(weights).reduce((sum, value) => sum + value, 0) || 1;
  const scale = 100 / totalIcpWeight;
  const components: ScoreComponent[] = [];

  const industryTargets = icp.targetIndustries;
  const industryHit = industryTargets.find((industry) => industryMatches(industry, company.industry));
  const knownIndustry = Boolean(company.industry);
  components.push({
    key: "industry",
    label: "Industry fit",
    points: points(industryHit ? weights.industry * scale : 0),
    max: points(weights.industry * scale),
    status: industryHit ? "matched" : knownIndustry ? "mismatch" : "unknown",
    reason: industryHit
      ? `${company.industry} matches your target industry “${industryHit}”.`
      : knownIndustry
        ? `${company.industry} is not in your target industries.`
        : "Industry is not verified for this company. No fit credit is given without evidence, and priority is capped.",
  });

  const size = sizeFit(icp, company, weights.size * scale);
  components.push({ ...size, max: points(weights.size * scale) });

  const geoHit = icp.geographies.find((geo) => locationMatches(geo, company.location));
  components.push({
    key: "geography",
    label: "Geography fit",
    points: points(geoHit ? weights.geography * scale : company.location ? 0 : weights.geography * scale * 0.15),
    max: points(weights.geography * scale),
    status: geoHit ? "matched" : company.location ? "mismatch" : "unknown",
    reason: geoHit
      ? `${company.location} is inside your ${geoHit} coverage.`
      : company.location
        ? `${company.location} is outside your target geographies.`
        : "Location is not verified. Partial neutral credit — treat as an estimate.",
  });

  const signalText = signals
    .map((signal) => `${signal.title} ${signal.summary} ${signal.evidence ?? ""}`)
    .join(" ")
    .toLowerCase();
  const roleHit = icp.buyerRoles.find((role) => {
    const words = tokens(role);
    if (words.length === 0) return false;
    return words.some((word) => word.length >= 4 && signalText.includes(word));
  });
  const leadershipSignal = signals.some((signal) => signal.type === "LEADERSHIP" || signal.type === "HIRING");
  components.push({
    key: "buyerRole",
    label: "Buyer-role relevance",
    points: points(roleHit ? weights.buyerRole * scale : leadershipSignal ? weights.buyerRole * scale * 0.5 : weights.buyerRole * scale * 0.25),
    max: points(weights.buyerRole * scale),
    status: roleHit ? "matched" : leadershipSignal ? "partial" : "unknown",
    reason: roleHit
      ? `Public evidence mentions “${roleHit}” — a role you identified as a buyer.`
      : leadershipSignal
        ? "Hiring or leadership activity detected, but the exact buyer role is not confirmed."
        : "No public buyer-role evidence yet. Neutral partial credit — this is a hypothesis, not a fact.",
  });

  const wantedTypes = new Set(
    icp.buyingTriggers
      .map((trigger) => TRIGGER_TO_SIGNAL[trigger])
      .filter((type): type is SignalType => Boolean(type)),
  );
  const signalTypes = new Set(signals.map((signal) => signal.type));
  const triggerHits = [...wantedTypes].filter((type) => signalTypes.has(type));
  const painHit = matchPain(`${company.description ?? ""} ${signalText}`, icp.painPoints);
  let triggerPoints = 0;
  let triggerReason = "No buying-trigger evidence yet. This keeps ICP fit independent from live signals.";
  if (triggerHits.length > 0) {
    triggerPoints = weights.triggerAlignment * scale * Math.min(1, 0.55 + (triggerHits.length / Math.max(1, wantedTypes.size)) * 0.45);
    triggerReason = `Detected ${triggerHits.map((type) => SIGNAL_META[type].label.toLowerCase()).join(", ")} — matched to the triggers you care about.`;
  }
  if (painHit) {
    triggerPoints = Math.max(triggerPoints, weights.triggerAlignment * scale * 0.6);
    triggerReason += ` Pain-point relevance: “${painHit}”.`;
  }
  components.push({
    key: "triggerAlignment",
    label: "Trigger & pain relevance",
    points: points(triggerPoints),
    max: points(weights.triggerAlignment * scale),
    status: triggerHits.length > 0 || painHit ? (triggerHits.length >= 2 ? "matched" : "partial") : "unknown",
    reason: triggerReason,
  });

  let icpScore = clamp(Math.round(components.reduce((sum, component) => sum + component.points, 0)), 0, 100);
  const exclusion = exclusionHit(icp, company);
  if (exclusion) {
    icpScore = Math.min(icpScore, 35);
    components.push({
      key: "exclusion",
      label: "Exclusion criteria",
      points: 0,
      max: 0,
      status: "excluded",
      reason: `Matches your exclusion “${exclusion}”. ICP-fit is capped at 35.`,
    });
  }

  const selected = new Set<SignalType>(
    icp.selectedSignalTypes.length > 0 ? (icp.selectedSignalTypes as SignalType[]) : (Object.keys(config.signalWeights) as SignalType[]),
  );
  const usableSignals = signals.filter((signal) => selected.has(signal.type));
  const seenByType = new Map<SignalType, number>();
  const contributions: SignalContribution[] = [];
  let rawTotal = 0;
  for (const signal of usableSignals) {
    const base = config.signalWeights[signal.type] ?? 0;
    const seen = seenByType.get(signal.type) ?? 0;
    seenByType.set(signal.type, seen + 1);
    const diminishing = 1 / Math.sqrt(seen + 1);
    const timestamp = signal.publishedAt ?? signal.discoveredAt;
    const ageDays = Math.max(0, (now.getTime() - timestamp.getTime()) / 86_400_000);
    const recency = Math.max(0.15, Math.pow(0.5, ageDays / config.recencyHalfLifeDays));
    const confidenceFactor = 0.55 + signal.confidence * 0.45;
    const signalPoints = base * confidenceFactor * recency * diminishing;
    rawTotal += signalPoints;
    contributions.push({
      id: signal.id,
      type: signal.type,
      label: SIGNAL_META[signal.type]?.label ?? signal.type,
      points: points(signalPoints),
      confidence: signal.confidence,
      recencyDays: Math.round(ageDays),
      reason: `${SIGNAL_META[signal.type]?.label ?? signal.type}: ${Math.round(signal.confidence * 100)}% confidence, ${Math.round(recency * 100)}% recency factor${seen > 0 ? ", diminishing repeat" : ""}.`,
    });
  }
  contributions.sort((a, b) => b.points - a.points);
  const distinctCategories = new Set(usableSignals.map((signal) => signal.type)).size;
  const diversityBonus = distinctCategories > 1 ? Math.min(8, (distinctCategories - 1) * 3) : 0;
  const baseSignalScore = 100 * (1 - Math.exp(-rawTotal / 22));
  const signalScore = usableSignals.length > 0 ? clamp(Math.round(baseSignalScore + diversityBonus), 0, 100) : 0;

  const priorityIcpWeight = Math.max(0, config.priorityIcpWeight);
  const prioritySignalWeight = Math.max(0, config.prioritySignalWeight);
  const priorityTotalWeight = priorityIcpWeight + prioritySignalWeight || 1;
  // Signal strength should not carry a company that does not fit the profile.
  // The signal term is discounted when ICP fit is low, while a fit-only
  // configuration (icpWeight 100) stays exactly equal to the ICP score.
  const signalFitMultiplier = 0.35 + 0.65 * (icpScore / 100);
  const uncappedTotal = clamp(
    Math.round(
      (icpScore * priorityIcpWeight + signalScore * prioritySignalWeight * signalFitMultiplier) / priorityTotalWeight,
    ),
    0,
    100,
  );

  // Fit has to be evidence-backed. Without a verified industry the company can
  // still be interesting, but it must not outrank a profile that does fit.
  const industryConfigured = industryTargets.length > 0;
  let cap: number | null = null;
  let capReason: string | null = null;
  if (industryConfigured && knownIndustry && !industryHit) {
    cap = 35;
    capReason = "Industry is verified but outside your target industries.";
  } else if (industryConfigured && !knownIndustry) {
    cap = 45;
    capReason = "Industry is not verified for this company.";
  }
  const priorityScore = cap == null ? uncappedTotal : Math.min(uncappedTotal, cap);

  return {
    icpScore,
    signalScore,
    priorityScore,
    breakdown: {
      icp: {
        total: icpScore,
        components,
        excluded: Boolean(exclusion),
        explanation: "ICP fit measures how closely verified company attributes match your stated profile. Unknown values receive neutral partial credit and are labelled unverified.",
      },
      signal: {
        total: signalScore,
        contributions,
        distinctCategories,
        diversityBonus,
        explanation: "Signal score combines category weight, evidence confidence, recency decay and diminishing returns for repeated signals of the same type. It is an intent index, not a probability of purchase.",
      },
      priority: {
        total: priorityScore,
        uncappedTotal,
        icpWeight: priorityIcpWeight,
        signalWeight: prioritySignalWeight,
        signalFitMultiplier: Math.round(signalFitMultiplier * 100) / 100,
        cap,
        capReason,
        formula: `round((${icpScore} × ${priorityIcpWeight} + ${signalScore} × ${prioritySignalWeight} × ${Math.round(signalFitMultiplier * 100) / 100} fit) / ${priorityTotalWeight})${cap == null ? "" : `, capped at ${cap}`}`,
      },
      configVersion: "default-v1",
      scoredAt: now.toISOString(),
    },
  };
}
