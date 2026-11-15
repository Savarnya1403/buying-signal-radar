import type { SignalType, SourceType } from "@prisma/client";
import { stripHtml } from "./extraction";

export type SignalCandidate = {
  type: SignalType;
  confidence: number;
  evidence: string;
  label: string;
};

type Rule = {
  type: SignalType;
  patterns: RegExp[];
  confidence: number;
  label: string;
  requiresContext?: RegExp;
};

const RULES: Rule[] = [
  {
    type: "FUNDING",
    label: "Funding event",
    confidence: 0.9,
    patterns: [
      /\b(raises?|raised|raising)\s+(?:\$|€|£|usd|eur|gbp)?\s?[\d.,]+\s?(?:m|b|million|billion|k)\b/i,
      /\b(series\s+[a-e]|seed\s+round|pre-seed|funding\s+round|venture\s+round|growth\s+round)\b/i,
      /\b(secures?|secured|closes?|closed|lands?|landed)\s+(?:\$|€|£)[\d.,]+\s?(?:m|b|million|billion)/i,
      /\b(backed\s+by|led\s+by)\s+[A-Z][\w\s&.-]{2,40}(ventures|capital|partners)/i,
      /\b(valuation|investment\s+round|new\s+capital)\b/i,
    ],
  },
  {
    type: "HIRING",
    label: "Hiring activity",
    confidence: 0.82,
    patterns: [
      /\b(we(?:'re|\sare)\s+hiring|now\s+hiring|open\s+roles?|open\s+positions?|join\s+our\s+team|current\s+openings?)\b/i,
      /\b(hiring|recruiting)\s+(?:a|an|for)?\s*(?:senior|staff|lead|head|vp|director|manager|engineer|sales|marketing|product)/i,
      /\b(new\s+role|headcount\s+(?:growth|increase)|expanding\s+(?:the\s+)?team)\b/i,
      /\b(account\s+executive|sales\s+development|revenue\s+operations|customer\s+success\s+manager|product\s+manager|software\s+engineer)\b/i,
    ],
  },
  {
    type: "EXPANSION",
    label: "Geographic expansion",
    confidence: 0.78,
    patterns: [
      /\b(expands?|expanding)\s+(?:in|into|to|across)\s+[A-Z][\w\s,.-]{2,50}/,
      /\b(opens?|opening)\s+(?:a\s+)?(?:new\s+)?(?:office|hub|headquarters|location)\s+(?:in|at)\s+[A-Z]/,
      /\b(enters?|entering)\s+(?:the\s+)?[A-Z][\w\s-]{2,40}\s+market\b/,
      /\b(launches?|launching)\s+in\s+(?:the\s+)?(?:US|UK|Europe|Germany|France|Canada|Australia|India|Singapore|Japan|Brazil|Mexico)\b/i,
      /\b(new\s+market|international\s+expansion|go-to-market\s+expansion)\b/i,
    ],
  },
  {
    type: "PRODUCT_LAUNCH",
    label: "Product launch",
    confidence: 0.8,
    patterns: [
      /\b(launches?|launched|unveils?|unveiled|introduces?|introduced|debuts?|rolls?\s+out)\s+(?:a\s+)?(?:new\s+)?(?:ai\s+|platform|product|feature|version|tool|agent|api|app)\b/i,
      /\b(general\s+availability|now\s+available|public\s+beta|new\s+product|product\s+launch)\b/i,
      /\b(announces?|announced)\s+(?:the\s+)?(?:launch|release|general\s+availability)\b/i,
    ],
  },
  {
    type: "TECHNOLOGY_CHANGE",
    label: "Technology change",
    confidence: 0.72,
    patterns: [
      /\b(migrat(?:es|ed|ing|ion)\s+(?:to|from)|switches?\s+to|switched\s+to|replatform(?:s|ed|ing)?|replaces?\s+(?:its|their)\s+[a-z]+\s+(?:stack|platform|system))\b/i,
      /\b(adopts?|adopted|implemented|deployed)\s+(?:a\s+)?(?:new\s+)?(?:ai|cloud|data|security|crm|erp)\s+(?:platform|stack|system|tool)\b/i,
      /\b(technology\s+change|tech\s+stack|moderni[sz](?:es|ed|ation)|digital\s+transformation)\b/i,
    ],
  },
  {
    type: "PARTNERSHIP",
    label: "Strategic partnership",
    confidence: 0.78,
    patterns: [
      /\b(partners?\s+with|partnered\s+with|partnership\s+with|teams?\s+up\s+with|teamed\s+up\s+with)\s+[A-Z][\w\s&.-]{2,50}/,
      /\b(strategic\s+(?:partnership|alliance)|reseller\s+agreement|distribution\s+partnership)\b/i,
      /\b(integrates?\s+with|integration\s+with)\s+[A-Z][\w\s&.-]{2,40}/,
    ],
  },
  {
    type: "LEADERSHIP",
    label: "Leadership change",
    confidence: 0.82,
    patterns: [
      /\b(appoints?|appointed|names?|named|hires?|hired)\s+[A-Z][\w\s.-]{2,40}\s+(?:as\s+)?(?:CEO|CTO|CFO|COO|CRO|CMO|CISO|CPO|VP|Chief|Head\s+of|President)/,
      /\b(joins?|joined)\s+(?:as|the\s+team\s+as)\s+(?:CEO|CTO|CFO|COO|CRO|CMO|CISO|CPO|VP|Chief|Head\s+of)/i,
      /\b(new\s+(?:CEO|CTO|CFO|COO|CRO|CMO|CISO|CPO|VP\s+of\s+\w+|Chief\s+\w+\s+Officer))\b/i,
      /\b(steps?\s+down|stepping\s+down|departs?|promotes?|promoted\s+to)\b/i,
    ],
  },
  {
    type: "CUSTOMER_GROWTH",
    label: "Customer growth",
    confidence: 0.72,
    patterns: [
      /\b(customer\s+base|customer\s+count|customers?)\s+(?:grew|doubled|tripled|surpassed|reached|expanded|increased)\b/i,
      /\b(arr|revenue|bookings)\s+(?:grew|increased|doubled|surpassed|reached)\b/i,
      /\b(\d[\d,.]*\s*(?:k|m|million|billion)?\+?\s+(?:customers|users|companies|teams))\b/i,
      /\b(customer\s+growth|record\s+adoption|rapid\s+adoption|strong\s+demand)\b/i,
    ],
  },
  {
    type: "CUSTOMER_COMPLAINT",
    label: "Public customer complaint",
    confidence: 0.7,
    patterns: [
      /\b(customers?\s+(?:complain|complained|are\s+frustrated|are\s+dissatisfied|are\s+angry))\b/i,
      /\b(backlash|complaints?\s+(?:about|over)|public\s+outage|service\s+outage|downtime|major\s+bug|data\s+breach)\b/i,
      /\b(poor\s+(?:customer\s+)?support|billing\s+complaints?|pricing\s+backlash|churn\s+problems?)\b/i,
    ],
  },
];

const SOURCE_RELIABILITY: Record<SourceType, number> = {
  JOB_FEED: 0.98,
  WEBSITE: 0.9,
  URL: 0.88,
  RSS: 0.84,
  HN: 0.8,
  WEB_SEARCH: 0.72,
};

function findEvidence(text: string, pattern: RegExp): string | null {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const match = sentences.find((sentence) => pattern.test(sentence));
  return match ? stripHtml(match).slice(0, 400) : null;
}

export function classifySignal(input: {
  title: string;
  summary?: string | null;
  content?: string | null;
  sourceType: SourceType;
  signalHints?: SignalType[];
  companyConfidence?: number;
}): SignalCandidate[] {
  const text = stripHtml([input.title, input.summary, input.content].filter(Boolean).join(". ")).slice(0, 12_000);
  const sourceFactor = SOURCE_RELIABILITY[input.sourceType] ?? 0.75;
  const companyFactor = 0.7 + (input.companyConfidence ?? 0.8) * 0.3;
  const candidates: SignalCandidate[] = [];

  // Source-derived hints are high precision: a job post is hiring evidence, a
  // Show HN post is a launch. We still add any other explicit rule matches.
  for (const hint of input.signalHints ?? []) {
    const base = hint === "HIRING" ? 0.95 : hint === "PRODUCT_LAUNCH" ? 0.86 : 0.8;
    candidates.push({
      type: hint,
      confidence: Math.min(0.98, base * companyFactor),
      evidence: stripHtml(input.summary || input.title).slice(0, 400),
      label: hint === "HIRING" ? "Public job posting" : hint === "PRODUCT_LAUNCH" ? "Public launch post" : "Public source",
    });
  }

  for (const rule of RULES) {
    if (candidates.some((candidate) => candidate.type === rule.type)) continue;
    for (const pattern of rule.patterns) {
      const match = text.match(pattern);
      if (!match) continue;
      const evidence = findEvidence(text, pattern) ?? stripHtml(match[0]).slice(0, 400);
      candidates.push({
        type: rule.type,
        confidence: Math.min(0.97, rule.confidence * sourceFactor * companyFactor),
        evidence,
        label: rule.label,
      });
      break;
    }
  }

  const unique = new Map<SignalType, SignalCandidate>();
  for (const candidate of candidates.sort((a, b) => b.confidence - a.confidence)) {
    if (!unique.has(candidate.type)) unique.set(candidate.type, candidate);
  }

  // One document can legitimately carry two signals, but we avoid flooding a
  // company with weak secondary classifications.
  return [...unique.values()]
    .filter((candidate) => candidate.confidence >= 0.5)
    .slice(0, 2);
}

export const SIGNAL_RULE_COUNT = RULES.length;
