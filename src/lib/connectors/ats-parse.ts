import type { AtsProvider } from "./ats-types";

export type AtsBoardRef = { provider: AtsProvider; token: string };

const BOARD_PATTERNS: { provider: AtsProvider; pattern: RegExp }[] = [
  {
    provider: "greenhouse",
    pattern: /(?:job-boards|boards)(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board\?for=)?([a-z0-9_-]+)/gi,
  },
  { provider: "lever", pattern: /jobs(?:\.eu)?\.lever\.co\/([a-z0-9_-]+)/gi },
  { provider: "ashby", pattern: /jobs\.ashbyhq\.com\/([a-z0-9_-]+)/gi },
];

const IGNORED_TOKENS = new Set(["embed", "job_board", "jobs", "careers", "index", "search"]);

export function normalizeDomain(input: string): string | null {
  const value = input.trim().toLowerCase();
  if (!value) return null;
  const candidate = /^https?:\/\//.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    const host = url.hostname.replace(/^www\./, "");
    if (!host.includes(".") || host.includes(" ")) return null;
    return host;
  } catch {
    return null;
  }
}

export function atsFromHtml(html: string): AtsBoardRef | null {
  for (const { provider, pattern } of BOARD_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of html.matchAll(pattern)) {
      const token = match[1]?.toLowerCase();
      if (token && token.length > 1 && !IGNORED_TOKENS.has(token)) return { provider, token };
    }
  }
  return null;
}

export function companyNameFromDomain(domain: string): string {
  const label = domain.split(".")[0] ?? domain;
  return label
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function titleFromHtml(html: string): string | null {
  const og = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']{2,80})["']/i);
  if (og?.[1]) return og[1].trim();
  const title = html.match(/<title[^>]*>([^<]{2,120})<\/title>/i);
  if (!title?.[1]) return null;
  return (
    title[1]
      .split(/\s*[|·–—-]\s*/)[0]
      ?.replace(/\b(careers|jobs|hiring|home)\b/gi, "")
      .trim()
      .slice(0, 80) || null
  );
}
