import { z } from "zod";
import { safeFetch } from "@/lib/http/safe-fetch";
import { domainFromUrl, extractCompanyFromHeadline, normalizeCompanyName, parseDate, stripHtml, truncateEvidence } from "./extraction";
import { ConnectorUnavailableError, type ConnectorResult, type RawDocument, type SourceConnector } from "./types";

export const webSearchConfigSchema = z.object({
  provider: z.enum(["tavily", "brave"]),
  query: z.string().trim().min(3).max(400),
  maxResults: z.number().int().min(1).max(20).default(8),
});

export type WebSearchConfig = z.infer<typeof webSearchConfigSchema>;

type SearchResult = {
  title?: string;
  url?: string;
  content?: string;
  description?: string;
  published_date?: string;
  age?: string;
};

export function parseSearchResults(results: SearchResult[], config: WebSearchConfig): { documents: RawDocument[]; warnings: string[] } {
  const documents: RawDocument[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    if (!result.title || !result.url || seen.has(result.url)) continue;
    seen.add(result.url);
    const title = stripHtml(result.title).trim();
    const extracted = extractCompanyFromHeadline(title);
    const domain = domainFromUrl(result.url);
    const fallbackName = domain ? domain.split(".")[0].replace(/[-_]/g, " ") : null;
    const name = extracted?.name ?? (fallbackName ? normalizeCompanyName(fallbackName) : null);
    if (!name) {
      warnings.push(`Search result skipped — no company could be inferred from “${title.slice(0, 70)}”.`);
      continue;
    }
    documents.push({
      title,
      url: result.url,
      publishedAt: parseDate(result.published_date),
      summary: truncateEvidence(result.content || result.description || title, 500),
      content: stripHtml(result.content ?? result.description ?? "").slice(0, 5000),
      sourceName: `${config.provider === "tavily" ? "Tavily" : "Brave Search"} · authorise provider`,
      sourceType: "WEB_SEARCH",
      company: {
        name,
        confidence: extracted?.confidence ?? 0.45,
        domain,
        website: domain ? `https://${domain}` : null,
      },
      tags: ["search-result"],
      metadata: { provider: config.provider, query: config.query, extractionPattern: extracted?.pattern ?? "domain-fallback" },
    });
  }

  return { documents, warnings };
}

function providerKey(provider: WebSearchConfig["provider"]): string | undefined {
  if (provider === "tavily") return process.env.TAVILY_API_KEY;
  return process.env.BRAVE_SEARCH_API_KEY;
}

export const webSearchConnector: SourceConnector<WebSearchConfig> = {
  kind: "WEB_SEARCH",
  label: "Authorised web search",
  description: "Query an approved search API (Tavily or Brave) for public funding, hiring, launch and expansion news.",
  configSchema: webSearchConfigSchema,
  requiresEnv: ["TAVILY_API_KEY"],
  isConfigured: () => Boolean(process.env.TAVILY_API_KEY || process.env.BRAVE_SEARCH_API_KEY),
  docs: "Configure TAVILY_API_KEY or BRAVE_SEARCH_API_KEY. We only use official, paid/authorised APIs with attribution and never scrape search-engine result pages.",
  async fetch(config): Promise<ConnectorResult> {
    const key = providerKey(config.provider);
    if (!key) {
      throw new ConnectorUnavailableError(
        config.provider === "tavily"
          ? "Tavily is not configured. Set TAVILY_API_KEY to enable this connector."
          : "Brave Search is not configured. Set BRAVE_SEARCH_API_KEY to enable this connector.",
      );
    }

    if (config.provider === "tavily") {
      const result = await safeFetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({
          query: config.query,
          search_depth: "basic",
          max_results: config.maxResults,
          include_answer: false,
          include_raw_content: false,
        }),
        timeoutMs: 15_000,
      });
      const json = JSON.parse(result.text) as { results?: SearchResult[] };
      const parsed = parseSearchResults(json.results ?? [], config);
      return { documents: parsed.documents, warnings: parsed.warnings, attribution: "Tavily Search API" };
    }

    const params = new URLSearchParams({ q: config.query, count: String(config.maxResults), text_decorations: "false" });
    const result = await safeFetch(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`, {
      headers: { accept: "application/json", "x-subscription-token": key },
      timeoutMs: 15_000,
    });
    const json = JSON.parse(result.text) as { web?: { results?: { title?: string; url?: string; description?: string; age?: string }[] } };
    const parsed = parseSearchResults(json.web?.results ?? [], config);
    return { documents: parsed.documents, warnings: parsed.warnings, attribution: "Brave Search API" };
  },
};
