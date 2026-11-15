import {
  BUYER_ROLES,
  BUYING_TRIGGERS,
  GEOGRAPHIES,
  INDUSTRIES,
  PAIN_POINTS,
  PRODUCT_CATEGORIES,
  SIZE_PRESETS,
  type TaxonomyEntry,
} from "./taxonomy";

export type FieldRationale = {
  field: string;
  label: string;
  confidence: number;
  evidence: string[];
  note: string;
};

export type IcpInterpretation = {
  productCategory: string;
  targetIndustries: string[];
  companySizeMin: number | null;
  companySizeMax: number | null;
  geographies: string[];
  buyerRoles: string[];
  painPoints: string[];
  buyingTriggers: string[];
  exclusions: string[];
  selectedSignalTypes: string[];
  discoveryPeriodDays: number;
  confidence: number;
  rationale: FieldRationale[];
  warnings: string[];
};

const ALL_SIGNALS = [
  "HIRING",
  "FUNDING",
  "EXPANSION",
  "PRODUCT_LAUNCH",
  "TECHNOLOGY_CHANGE",
  "PARTNERSHIP",
  "LEADERSHIP",
  "CUSTOMER_GROWTH",
  "CUSTOMER_COMPLAINT",
];

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalize(text: string) {
  return text
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sentences(text: string) {
  return normalize(text)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function finding(text: string, entries: TaxonomyEntry[], limit = 12): { labels: string[]; evidence: string[] } {
  const haystack = normalize(text).toLowerCase();
  const labels: string[] = [];
  const evidence: string[] = [];
  const all = sentences(text);

  for (const entry of entries) {
    const hit = entry.aliases.some((alias) => {
      const pattern = new RegExp(`(?<![a-z0-9])${escapeRegex(alias.toLowerCase())}(?![a-z0-9])`, "i");
      return pattern.test(haystack);
    });
    if (!hit) continue;
    if (!labels.includes(entry.label)) labels.push(entry.label);
    const source = all.find((sentence) => {
      const lower = sentence.toLowerCase();
      return entry.aliases.some((alias) => {
        const pattern = new RegExp(`(?<![a-z0-9])${escapeRegex(alias.toLowerCase())}(?![a-z0-9])`, "i");
        return pattern.test(lower);
      });
    });
    if (source && !evidence.includes(source)) evidence.push(source);
    if (labels.length >= limit) break;
  }
  return { labels, evidence };
}

const NEGATION = /\b(?:do not|don't|does not|doesn't|never|not for|not looking|exclude|excluding|avoid|no longer|we don't|we do not|not target|not serve)\b/i;

function isNegated(sentence: string) {
  return NEGATION.test(sentence) && !/\bnot only\b/i.test(sentence);
}

function extractProductCategory(text: string): { value: string; confidence: number; evidence: string[]; note: string } {
  const category = finding(text, PRODUCT_CATEGORIES, 1);
  const normalizedText = normalize(text);
  const patterns = [
    /\b(?:we|i)\s+(?:sell|build|offer|provide|make|ship)\s+(?:an?\s+|the\s+)?([^.;\n]+)/i,
    /\b(?:our|my)\s+(?:product|platform|software|tool|service|company)\s+(?:is|helps?|lets?)\s+([^.;\n]+)/i,
    /\bwe(?:'re| are)\s+(?:building|selling|launching)\s+([^.;\n]+)/i,
  ];

  for (const pattern of patterns) {
    const match = normalizedText.match(pattern);
    if (!match?.[1]) continue;
    let candidate = match[1]
      .split(/\s+(?:for|that|which|to help|so that|so they)\s+/i)[0]
      .replace(/^(?:a|an|the)\s+/i, "")
      .replace(/[.,;:]+$/, "")
      .trim();
    candidate = candidate.split(/\s+/).slice(0, 9).join(" ");
    if (candidate.length < 3) continue;
    if (category.labels.length > 0) {
      return {
        value: category.labels[0],
        confidence: 0.88,
        evidence: category.evidence.length > 0 ? category.evidence : [match[0]],
        note: `Matched a known product category. Description reads: “${match[0]}”.`,
      };
    }
    const pretty = candidate.charAt(0).toUpperCase() + candidate.slice(1);
    return {
      value: pretty,
      confidence: 0.62,
      evidence: [match[0]],
      note: "Extracted from the way you describe what you sell. Rename it if needed.",
    };
  }

  if (category.labels.length > 0) {
    return {
      value: category.labels[0],
      confidence: 0.78,
      evidence: category.evidence,
      note: "Matched a known product category in your description.",
    };
  }

  return {
    value: "B2B software",
    confidence: 0.3,
    evidence: [],
    note: "Could not confidently identify a category. Edit this before discovery.",
  };
}

function extractSize(text: string): {
  min: number | null;
  max: number | null;
  confidence: number;
  evidence: string[];
  note: string;
} {
  const all = sentences(text);
  const targetSentences = all.filter((sentence) => !isNegated(sentence));

  for (const sentence of targetSentences) {
    const normalized = sentence.replace(/,/g, "").toLowerCase();
    const range = normalized.match(/(\d+)\s*(?:-|to)\s*(\d+)\s*(?:employees|people|staff|headcount|fte|person|employee)/);
    if (range) {
      const min = Number(range[1]);
      const max = Number(range[2]);
      if (min < max) {
        return {
          min,
          max,
          confidence: 0.94,
          evidence: [sentence],
          note: `Explicit headcount range of ${min.toLocaleString()}–${max.toLocaleString()}.`,
        };
      }
    }
    const under = normalized.match(/(?:under|below|less than|fewer than|up to|max(?:imum)? of)\s+(\d+)\s*(?:employees|people|staff|headcount|fte|person|employee)/);
    if (under) {
      return {
        min: 1,
        max: Number(under[1]),
        confidence: 0.82,
        evidence: [sentence],
        note: `Upper bound of ${Number(under[1]).toLocaleString()} employees.`,
      };
    }
    const over = normalized.match(/(?:over|above|more than|at least|minimum of)\s+(\d+)\s*(?:employees|people|staff|headcount|fte|person|employee)/);
    if (over) {
      return {
        min: Number(over[1]),
        max: null,
        confidence: 0.8,
        evidence: [sentence],
        note: `Lower bound of ${Number(over[1]).toLocaleString()} employees.`,
      };
    }
    const plus = normalized.match(/(\d+)\s*\+\s*(?:employees|people|staff|headcount|fte)/);
    if (plus) {
      return {
        min: Number(plus[1]),
        max: null,
        confidence: 0.78,
        evidence: [sentence],
        note: `${Number(plus[1]).toLocaleString()}+ employees.`,
      };
    }
  }

  const lower = normalize(text).toLowerCase();
  for (const [key, preset] of Object.entries(SIZE_PRESETS)) {
    if (new RegExp(`(?<![a-z])${escapeRegex(key)}(?![a-z])`, "i").test(lower)) {
      const negated = all.some((sentence) => isNegated(sentence) && sentence.toLowerCase().includes(key));
      if (!negated) {
        return {
          min: preset.min,
          max: preset.max,
          confidence: 0.58,
          evidence: [all.find((sentence) => sentence.toLowerCase().includes(key)) ?? ""].filter(Boolean),
          note: `Inferred from “${key}”. Replace with a headcount range for better matching.`,
        };
      }
    }
  }

  return {
    min: null,
    max: null,
    confidence: 0.2,
    evidence: [],
    note: "No clear company size found. Add a range to improve ICP-fit scoring.",
  };
}

function extractPainPoints(text: string): { values: string[]; evidence: string[]; confidence: number } {
  const lexicon = finding(text, PAIN_POINTS, 7);
  const values = [...lexicon.labels];
  const evidence = [...lexicon.evidence];
  const normalized = normalize(text);

  const explicit = normalized.match(/\b(?:pain points?|problems?|struggles?)\s*(?:are|include|:)\s*([^.!?]+)/i);
  if (explicit?.[1]) {
    for (const raw of explicit[1].split(/,| and /i)) {
      const value = raw.trim().replace(/^the\s+/i, "");
      if (value.length > 2 && value.length < 60) {
        const pretty = value.charAt(0).toUpperCase() + value.slice(1);
        if (!values.some((existing) => existing.toLowerCase() === pretty.toLowerCase())) values.push(pretty);
      }
    }
    evidence.push(explicit[0]);
  }

  const verbPattern =
    /\b(?:helps?|lets?|enables?|allows?)\s+[^.]{0,45}?\b(?:to\s+)?(reduce|cut|avoid|increase|improve|forecast|spot|automate|manage|track|close|find|generate|streamline|simplify|prevent|detect|monitor|scale|hire|onboard|get)\s+([^.;,]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = verbPattern.exec(normalized)) && values.length < 7) {
    const phrase = match[2].trim().split(/\s+/).slice(0, 6).join(" ");
    if (phrase.length < 3) continue;
    const pretty = phrase.charAt(0).toUpperCase() + phrase.slice(1);
    if (!values.some((existing) => existing.toLowerCase().includes(pretty.toLowerCase().slice(0, 8)))) values.push(pretty);
    const sentence = sentences(text).find((item) => item.toLowerCase().includes(match![2].trim().toLowerCase().slice(0, 20)));
    if (sentence && !evidence.includes(sentence)) evidence.push(sentence);
  }

  return {
    values: values.slice(0, 7),
    evidence: evidence.slice(0, 4),
    confidence: lexicon.labels.length > 0 ? 0.82 : values.length > 0 ? 0.6 : 0.2,
  };
}

function extractExclusions(text: string): { values: string[]; evidence: string[] } {
  const values: string[] = [];
  const evidence: string[] = [];
  for (const sentence of sentences(text)) {
    if (!isNegated(sentence)) continue;
    const cleaned = sentence
      .replace(/^(?:we|i)\s+/i, "")
      .replace(/\b(?:do not|don't|does not|doesn't|never|not|exclude|excluding|avoid|no longer)\s+(?:work with|sell to|target|serve|want|need|focus on)?\s*/i, "")
      .replace(/^[,\s]+/, "")
      .replace(/[.!?]+$/, "")
      .trim();
    if (cleaned.length >= 4 && cleaned.length <= 160) {
      const pretty = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      if (!values.some((value) => value.toLowerCase() === pretty.toLowerCase())) values.push(pretty);
      evidence.push(sentence);
    }
  }
  return { values: values.slice(0, 5), evidence: evidence.slice(0, 3) };
}

function extractGeography(text: string): { values: string[]; evidence: string[]; confidence: number } {
  const all = sentences(text);
  const found = finding(text, GEOGRAPHIES, 10);
  const values: string[] = [];
  const evidence: string[] = [];
  for (const label of found.labels) {
    const entry = GEOGRAPHIES.find((item) => item.label === label)!;
    const source = all.find(
      (sentence) =>
        !isNegated(sentence) &&
        entry.aliases.some((alias) =>
          new RegExp(`(?<![a-z0-9])${escapeRegex(alias.toLowerCase())}(?![a-z0-9])`, "i").test(sentence.toLowerCase()),
        ),
    );
    if (!source) continue;
    values.push(label);
    if (!evidence.includes(source)) evidence.push(source);
  }

  // Two-letter market codes are ambiguous ("us" is a pronoun), so only match
  // them when the user wrote them in uppercase.
  const abbreviations: Record<string, { label: string; pattern: RegExp }> = {
    US: { label: "United States", pattern: /\bUS\b|\bU\.S\.\b/ },
    UK: { label: "United Kingdom", pattern: /\bUK\b|\bU\.K\.\b/ },
    EU: { label: "Europe", pattern: /\bEU\b/ },
    UAE: { label: "United Arab Emirates", pattern: /\bUAE\b/ },
  };
  for (const { label, pattern } of Object.values(abbreviations)) {
    if (!pattern.test(text) || values.includes(label)) continue;
    const source = all.find((sentence) => pattern.test(sentence) && !isNegated(sentence));
    if (!source) continue;
    values.push(label);
    if (!evidence.includes(source)) evidence.push(source);
  }
  return {
    values,
    evidence: evidence.slice(0, 3),
    confidence: values.length > 0 ? 0.86 : 0.2,
  };
}

function extractTriggers(text: string): { values: string[]; evidence: string[]; confidence: number } {
  const found = finding(text, BUYING_TRIGGERS, 9);
  if (found.labels.length > 0) {
    return { values: found.labels, evidence: found.evidence.slice(0, 4), confidence: 0.84 };
  }
  return {
    values: ["Hiring", "Funding", "Product launches", "Leadership changes"],
    evidence: [],
    confidence: 0.38,
  };
}

export function interpretProductDescription(description: string): IcpInterpretation {
  const text = normalize(description);
  const product = extractProductCategory(text);
  const industries = finding(text, INDUSTRIES, 8);
  const size = extractSize(text);
  const geography = extractGeography(text);
  const roles = finding(text, BUYER_ROLES, 8);
  const pains = extractPainPoints(text);
  const triggers = extractTriggers(text);
  const exclusions = extractExclusions(text);

  const rationale: FieldRationale[] = [
    {
      field: "productCategory",
      label: "Product category",
      confidence: product.confidence,
      evidence: product.evidence,
      note: product.note,
    },
    {
      field: "targetIndustries",
      label: "Target industries",
      confidence: industries.labels.length > 0 ? 0.87 : 0.2,
      evidence: industries.evidence.slice(0, 3),
      note:
        industries.labels.length > 0
          ? `Detected ${industries.labels.length} industries from your description. Add or remove any that do not fit.`
          : "No industries detected. Add at least one so ICP-fit scoring has a signal.",
    },
    {
      field: "companySize",
      label: "Company size",
      confidence: size.confidence,
      evidence: size.evidence,
      note: size.note,
    },
    {
      field: "geographies",
      label: "Geography",
      confidence: geography.confidence,
      evidence: geography.values.length > 0 ? geography.evidence : size.evidence.slice(0, 1),
      note:
        size.evidence.length > 0 && geography.values.length > 0
          ? "Geography comes from the sentence describing your size range. Give it a quick check."
          : geography.values.length > 0
            ? "Matched named countries or regions. Add cities or regions if you sell locally."
            : "No geography detected. Add at least one market.",
    },
    {
      field: "buyerRoles",
      label: "Buyer roles",
      confidence: roles.labels.length > 0 ? 0.85 : 0.2,
      evidence: roles.evidence.slice(0, 3),
      note:
        roles.labels.length > 0
          ? "These roles are used to interpret hiring and leadership signals."
          : "No buyer roles detected. Add the people who usually buy this product.",
    },
    {
      field: "painPoints",
      label: "Pain points",
      confidence: pains.confidence,
      evidence: pains.evidence,
      note: pains.values.length > 0 ? "Pain points are matched against public evidence to add context." : "Add the problems your product solves.",
    },
    {
      field: "buyingTriggers",
      label: "Buying triggers",
      confidence: triggers.confidence,
      evidence: triggers.evidence,
      note:
        triggers.evidence.length > 0
          ? "Triggers you named explicitly become the default signal categories."
          : "No triggers named, so we used sensible defaults. Adjust the signal categories below.",
    },
    {
      field: "exclusions",
      label: "Exclusions",
      confidence: exclusions.values.length > 0 ? 0.8 : 0.35,
      evidence: exclusions.evidence,
      note:
        exclusions.values.length > 0
          ? "Exclusion criteria are applied as a cap on ICP-fit score, never silently dropped."
          : "No explicit exclusions found. Add any deal-breakers.",
    },
  ];

  const weights = [0.1, 0.15, 0.14, 0.12, 0.12, 0.1, 0.1, 0.07];
  const confidence = rationale.reduce((total, field, index) => total + field.confidence * weights[index], 0);
  const warnings: string[] = [];
  if (industries.labels.length === 0) warnings.push("Add at least one target industry before running discovery.");
  if (geography.values.length === 0) warnings.push("No geography detected — add a market to improve fit scoring.");
  if (!size.min && !size.max) warnings.push("No company size detected — add an employee range for sharper ranking.");

  return {
    productCategory: product.value,
    targetIndustries: industries.labels,
    companySizeMin: size.min,
    companySizeMax: size.max,
    geographies: geography.values,
    buyerRoles: roles.labels,
    painPoints: pains.values,
    buyingTriggers: triggers.values,
    exclusions: exclusions.values,
    selectedSignalTypes: ALL_SIGNALS,
    discoveryPeriodDays: 30,
    confidence: Math.round(confidence * 100) / 100,
    rationale,
    warnings,
  };
}
