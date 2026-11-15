import { z } from "zod";
import { politeSleep, robotsAllows, safeFetch } from "@/lib/http/safe-fetch";
import { canonicalizeUrl, domainFromUrl, normalizeCompanyName, stripHtml, truncateEvidence } from "./extraction";
import { companyNameFromPage, extractPage } from "./page";
import type { ConnectorResult, RawDocument, SourceConnector } from "./types";

export const urlConfigSchema = z.object({
  url: z.string().url().max(2000),
  companyHint: z.string().trim().max(160).optional(),
});

export type UrlConfig = z.infer<typeof urlConfigSchema>;

export function documentFromPage(
  page: ReturnType<typeof extractPage>,
  url: string,
  sourceType: "URL" | "WEBSITE",
  companyHint?: string,
): RawDocument {
  const company = companyHint
    ? { name: normalizeCompanyName(companyHint), confidence: 0.95 }
    : companyNameFromPage(page, url);
  const domain = domainFromUrl(url);
  return {
    title: page.title || (domain ? `Page on ${domain}` : "Public web page"),
    url,
    publishedAt: page.publishedAt,
    summary: truncateEvidence(page.description || page.text, 600),
    content: page.text.slice(0, 10_000),
    sourceName: domain ? `Website · ${domain}` : "User-submitted URL",
    sourceType,
    company: {
      name: company.name,
      confidence: company.confidence,
      domain,
      website: domain ? `https://${domain}` : null,
      location: page.location,
      employeeCount: page.employeeCount,
      description: truncateEvidence(page.description || page.text, 800),
    },
    signalHints: page.isCareersPage ? ["HIRING"] : [],
    metadata: {
      roles: page.roles,
      isCareersPage: page.isCareersPage,
      jsonLdTypes: page.jsonLdTypes,
      canonicalUrl: page.canonicalUrl,
    },
  };
}

export const urlConnector: SourceConnector<UrlConfig> = {
  kind: "URL",
  label: "User-submitted URL",
  description: "Fetch a single public page a user explicitly submits — a press release, careers page, blog post or company announcement.",
  configSchema: urlConfigSchema,
  docs: "Respects robots.txt, blocks private addresses, LinkedIn and authenticated content, and follows at most three redirects. The page URL is always stored as provenance.",
  async fetch(config): Promise<ConnectorResult> {
    const url = canonicalizeUrl(config.url);
    const robots = await robotsAllows(url);
    if (!robots.allowed) {
      throw new Error(`Not fetched: ${robots.reason} Buying Signal Radar respects site access controls.`);
    }
    await politeSleep(robots.crawlDelay * 1000);
    const result = await safeFetch(url, { timeoutMs: 12_000 });
    if (!/text\/html|application\/xhtml/i.test(result.contentType) && !/xml/i.test(result.contentType)) {
      throw new Error(`Expected an HTML page but received ${result.contentType || "an unknown content type"}.`);
    }
    const page = extractPage(result.text, result.finalUrl);
    if (!page.title && page.text.length < 80) {
      throw new Error("The page did not contain enough readable public content to extract a signal.");
    }
    const document = documentFromPage(page, result.finalUrl, "URL", config.companyHint);
    return { documents: [document], warnings: [] };
  },
};

const DEFAULT_PATHS = ["/", "/careers", "/jobs", "/news", "/press", "/blog", "/changelog"];

export const websiteConfigSchema = z.object({
  website: z.string().url().max(2000),
  companyName: z.string().trim().max(160).optional(),
  paths: z.array(z.string().trim().min(1).max(120)).min(1).max(6).optional(),
});

export type WebsiteConfig = z.infer<typeof websiteConfigSchema>;

export function websitePageUrls(website: string, paths?: string[]): string[] {
  const base = new URL(website.endsWith("/") ? website : `${website}/`);
  const selected = paths?.length ? paths : DEFAULT_PATHS;
  const urls = new Set<string>();
  for (const path of selected) {
    urls.add(new URL(path.replace(/^\//, ""), base).toString());
  }
  return [...urls].slice(0, 6);
}

export const websiteConnector: SourceConnector<WebsiteConfig> = {
  kind: "WEBSITE",
  label: "Company website monitor",
  description: "Read permitted public pages on a company's own site (home, careers, news, blog, changelog) and extract evidence.",
  configSchema: websiteConfigSchema,
  docs: "Only public http(s) pages, robots.txt respected, no login walls, no anti-bot evasion. Limit: six pages per run and 2 MB per page.",
  async fetch(config): Promise<ConnectorResult> {
    const documents: RawDocument[] = [];
    const warnings: string[] = [];
    const origin = new URL(config.website);
    const domain = domainFromUrl(config.website);
    const pages = websitePageUrls(config.website, config.paths);
    let lastCompany: RawDocument["company"] | null = null;

    for (const pageUrl of pages) {
      try {
        const robots = await robotsAllows(pageUrl);
        if (!robots.allowed) {
          warnings.push(`${new URL(pageUrl).pathname}: skipped — ${robots.reason}`);
          continue;
        }
        await politeSleep(robots.crawlDelay * 1000 + 250);
        const result = await safeFetch(pageUrl, { timeoutMs: 10_000 });
        if (!/text\/html|application\/xhtml/i.test(result.contentType)) {
          warnings.push(`${new URL(pageUrl).pathname}: skipped — not an HTML page.`);
          continue;
        }
        const page = extractPage(result.text, result.finalUrl);
        if (!page.title && page.text.length < 100) {
          warnings.push(`${new URL(pageUrl).pathname}: no readable content.`);
          continue;
        }
        const document = documentFromPage(page, result.finalUrl, "WEBSITE", config.companyName);
        if (lastCompany && lastCompany.employeeCount && !document.company.employeeCount) {
          document.company.employeeCount = lastCompany.employeeCount;
        }
        if (document.company.employeeCount) lastCompany = document.company;
        documents.push(document);
      } catch (error) {
        warnings.push(
          `${new URL(pageUrl).pathname}: ${error instanceof Error ? error.message : "fetch failed"}`,
        );
      }
    }

    if (documents.length === 0) {
      throw new Error(`No public pages could be read from ${origin.hostname}. ${warnings.join(" ")}`.trim());
    }

    const domainDoc = documents.find((document) => document.company.employeeCount);
    if (domainDoc?.company.employeeCount) {
      for (const document of documents) {
        document.company.employeeCount = domainDoc.company.employeeCount;
        document.company.location = document.company.location ?? domainDoc.company.location;
      }
    }

    return { documents, warnings };
  },
};

export { stripHtml };
