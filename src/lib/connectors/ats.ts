import { safeFetch } from "@/lib/http/safe-fetch";
import { atsFromHtml, titleFromHtml } from "./ats-parse";
import type { AtsProvider } from "./ats-types";

export { atsFromHtml, companyNameFromDomain, normalizeDomain } from "./ats-parse";

export type AtsBoard = {
  provider: AtsProvider;
  token: string;
  companyName: string | null;
  discoveredFrom: string;
};

async function probeBoards(domain: string): Promise<{ provider: AtsProvider; token: string } | null> {
  const token = domain.split(".")[0];
  if (!token) return null;
  const probes: { provider: AtsProvider; url: string }[] = [
    { provider: "ashby", url: `https://api.ashbyhq.com/posting-api/job-board/${token}?includeCompensation=false` },
    { provider: "lever", url: `https://api.lever.co/v0/postings/${token}?mode=json` },
    { provider: "greenhouse", url: `https://boards-api.greenhouse.io/v1/boards/${token}/jobs` },
  ];
  for (const probe of probes) {
    try {
      const result = await safeFetch(probe.url, { timeoutMs: 6_000 });
      const body = result.text.trim();
      // A wrong token usually returns an error object or an empty list; a real board
      // always has a non-empty jobs array.
      const parsed = JSON.parse(body) as unknown;
      const jobs = Array.isArray(parsed)
        ? parsed
        : (parsed as { jobs?: unknown[]; postings?: unknown[] }).jobs ?? (parsed as { postings?: unknown[] }).postings;
      if (Array.isArray(jobs) && jobs.length > 0) return { provider: probe.provider, token };
    } catch {
      // Try the next provider.
    }
  }
  return null;
}

const CAREERS_PATHS = ["", "/careers", "/jobs", "/company/careers", "/about/careers", "/careers/jobs"];

/**
 * Resolves the applicant-tracking system behind a company's public careers page.
 * Only public pages and public ATS APIs are read; no login or anti-bot bypass.
 */
export async function detectAts(domain: string): Promise<AtsBoard | null> {
  const probe = await probeBoards(domain);
  if (probe) {
    return { ...probe, companyName: null, discoveredFrom: "public ATS API" };
  }

  for (const path of CAREERS_PATHS) {
    const url = `https://${domain}${path}`;
    try {
      const result = await safeFetch(url, { timeoutMs: 8_000 });
      const board = atsFromHtml(result.text);
      if (board) {
        return { ...board, companyName: titleFromHtml(result.text), discoveredFrom: url };
      }
    } catch {
      // Some paths will 404 or be disallowed; keep looking.
    }
  }
  return null;
}
