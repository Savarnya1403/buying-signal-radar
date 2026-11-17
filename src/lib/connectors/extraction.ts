import { INDUSTRIES } from "@/lib/icp/taxonomy";

const COMPANY_SUFFIXES = /\b(inc|inc\.|llc|ltd|ltd\.|limited|corp|corp\.|corporation|gmbh|ag|sa|sas|bv|plc|pty|oy|ab|as|co\.|company)\b\.?$/i;

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCompanyName(raw: string): string {
  return raw
    .replace(/&amp;/gi, "&")
    .replace(/^[\s"'“”]+|[\s"'“”.,:;|-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function companyKey(name: string): string {
  return normalizeCompanyName(name)
    .toLowerCase()
    .replace(COMPANY_SUFFIXES, "")
    .replace(/[^a-z0-9]/g, "");
}

export function domainFromUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function canonicalizeUrl(raw: string, base?: string): string {
  try {
    const url = new URL(raw, base);
    url.hash = "";
    const tracking = [
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id", "utm_name",
      "ref", "source", "mc_cid", "mc_eid", "gclid", "fbclid", "igshid", "s", "trk",
    ];
    for (const key of tracking) url.searchParams.delete(key);
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    url.searchParams.sort();
    return url.toString();
  } catch {
    return raw;
  }
}

export function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const ms = value > 1_000_000_000_000 ? value : value * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  if (date.getFullYear() < 1990 || date.getTime() > Date.now() + 86_400_000) return null;
  return date;
}

const GENERIC_NAMES = new Set([
  "the", "a", "an", "this", "that", "new", "why", "how", "what", "startup", "company", "report", "exclusive",
  "breaking", "opinion", "analysis", "interview", "funding", "weekly", "daily", "techcrunch", "show", "hn",
]);

export type CompanyExtraction = { name: string; confidence: number; pattern: string };

const NEWS_PREFIX = /^(?:exclusive|breaking|report|update|analysis|opinion|watch|video)\s*[:\-]\s*/i;
const DESCRIPTOR_PREFIX =
  /^(?:(?:[A-Za-z][\w&.'-]*\s+){0,4})(?:startup|fintech|healthtech|medtech|defencetech|insurtech|proptech|edtech|regtech|legaltech|martech|climatech|cleantech|biotech|devtools|ai)\s+/i;

function cleanCandidate(raw: string): string {
  let candidate = normalizeCompanyName(raw)
    .replace(/^(?:show hn|launch hn|ask hn)\s*[:\-]\s*/i, "")
    .replace(NEWS_PREFIX, "")
    .replace(DESCRIPTOR_PREFIX, "")
    .replace(/\s+(?:raises|raised|secures|secured|closes|lands|nabs|announces|launches|unveils|introduces|appoints|names|acquires|partners)\b.*$/i, "")
    .replace(/\s*[|–—-]\s*.*$/, "")
    .replace(/^["'“”]|["'“”]$/g, "")
    .trim();
  if (candidate.length > 60) candidate = candidate.slice(0, 60).replace(/\s+\S*$/, "");
  return candidate;
}

export function extractCompanyFromHeadline(title: string): CompanyExtraction | null {
  const clean = stripHtml(title).trim();
  const patterns: { regex: RegExp; confidence: number; pattern: string }[] = [
    { regex: /^(.{2,60}?)\s+(?:raises|raised|secures|secured|closes|lands|nabs)\s+(?:\$|€|£|\d)/i, confidence: 0.9, pattern: "funding-headline" },
    { regex: /^(.{2,60}?)\s+(?:announces?|closes?)\s+(?:\$|€|£)[\d.,]+\s*(?:m|b|million|billion)/i, confidence: 0.86, pattern: "funding-headline" },
    { regex: /^show hn\s*[:\-]\s*([^–\-:|]{2,50})/i, confidence: 0.88, pattern: "show-hn" },
    { regex: /^(.{2,60}?)\s+(?:launches|unveils|introduces|rolls out|debuts)\s+/i, confidence: 0.78, pattern: "launch-headline" },
    { regex: /^(.{2,60}?)\s+(?:appoints|names|hires)\s+/i, confidence: 0.74, pattern: "leadership-headline" },
    { regex: /^(.{2,60}?)\s+(?:acquires|partners with|teams up with)\s+/i, confidence: 0.74, pattern: "corporate-headline" },
    { regex: /^([A-Z][\w.&+'-]*(?:\s+[A-Z0-9][\w.&+'-]*){0,3})\s*[–—-]\s*.+$/, confidence: 0.55, pattern: "dash-headline" },
  ];

  for (const { regex, confidence, pattern } of patterns) {
    const match = clean.match(regex);
    if (!match?.[1]) continue;
    const name = cleanCandidate(match[1]);
    const lower = name.toLowerCase();
    if (name.length < 2 || GENERIC_NAMES.has(lower) || /^\d/.test(name)) continue;
    if (name.split(/\s+/).length > 6) continue;
    // A person, an investor or an unnamed "alum" is not a prospect company.
    if (/\b(?:alum|alumnus|alumni|founder|co-founder|veteran|investor)\b/i.test(name)) continue;
    if (/\b(?:capital|ventures|partners|equity|fund|vc)$/i.test(name)) continue;
    return { name, confidence, pattern };
  }
  return null;
}

export function extractRolesFromText(text: string, limit = 8): string[] {
  const patterns = [
    /\b(?:senior|staff|principal|lead|head of|director of|vp of|vice president of|chief)\s+[A-Z][A-Za-z/&+-]*(?:\s+[A-Z][A-Za-z/&+-]*){0,3}/g,
    /\b(?:account executive|sales development representative|sdr|revenue operations manager|customer success manager|product manager|software engineer|marketing manager|demand generation manager|people partner|recruiter|data engineer|solutions architect|growth manager)\b/gi,
  ];
  const roles = new Set<string>();
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const role = match[0].trim();
      if (role.length > 4 && role.length < 80) roles.add(role);
      if (roles.size >= limit) break;
    }
  }
  return [...roles];
}

/**
 * Infers a target industry from text using the same aliases the ICP interpreter
 * understands, so "payments" can support a "Fintech" profile. Word boundaries
 * and plurals are tolerated; short generic words never match on their own.
 */
export function inferIndustry(text: string, targetIndustries: string[]): { industry: string | null; confidence: number } {
  const lower = text.toLowerCase();
  for (const industry of targetIndustries) {
    const taxonomy = INDUSTRIES.find((entry) => entry.label.toLowerCase() === industry.toLowerCase());
    const aliases = taxonomy?.aliases ?? [industry.toLowerCase()];
    const hit = aliases.some((alias) => {
      if (alias.length < 4) return false;
      const pattern = new RegExp(`(?<![a-z0-9])${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:s|es)?(?![a-z0-9])`, "i");
      return pattern.test(lower);
    });
    if (hit) return { industry, confidence: taxonomy ? 0.65 : 0.55 };
  }
  return { industry: null, confidence: 0 };
}

export function cleanSourceName(raw: string): string {
  return raw.replace(/\s*[|–—-]\s*(?:TechCrunch|PR Newswire|Google News)\s*$/i, "").trim();
}

export function truncateEvidence(text: string, max = 420): string {
  return stripHtml(text).replace(/\s+/g, " ").trim().slice(0, max);
}
