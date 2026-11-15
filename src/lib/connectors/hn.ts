import { z } from "zod";
import { safeFetch } from "@/lib/http/safe-fetch";
import { extractCompanyFromHeadline, domainFromUrl, stripHtml, truncateEvidence } from "./extraction";
import type { ConnectorResult, RawDocument, SourceConnector } from "./types";

export const hnConfigSchema = z.object({
  query: z.string().trim().min(2).max(200),
  tags: z.enum(["show_hn", "story"]).default("show_hn"),
  minPoints: z.number().int().min(0).max(10_000).default(2),
  maxItems: z.number().int().min(1).max(30).default(15),
});

export type HnConfig = z.infer<typeof hnConfigSchema>;

type HnHit = {
  objectID: string;
  title?: string;
  url?: string | null;
  story_text?: string | null;
  created_at?: string;
  points?: number;
  num_comments?: number;
  author?: string;
  _tags?: string[];
};

export function parseHnHits(hits: HnHit[], config: HnConfig): { documents: RawDocument[]; warnings: string[] } {
  const documents: RawDocument[] = [];
  const warnings: string[] = [];

  for (const hit of hits) {
    const title = stripHtml(hit.title ?? "").trim();
    if (!title || !hit.objectID) continue;
    const externalUrl = hit.url?.trim();
    const domain = domainFromUrl(externalUrl);
    const cleaned = title.replace(/^show hn\s*[:\-]\s*/i, "");
    const extracted = extractCompanyFromHeadline(title);
    const companyName =
      extracted?.name ??
      cleaned.split(/\s*[–\-|:]\s*/)[0]?.trim().slice(0, 60) ??
      domain?.split(".")[0];

    if (!companyName || companyName.length < 2) {
      warnings.push(`Skipped HN item ${hit.objectID} — no company or product name in the title.`);
      continue;
    }

    documents.push({
      title,
      url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
      publishedAt: hit.created_at ? new Date(hit.created_at) : null,
      summary: truncateEvidence(
        hit.story_text || `${hit.points ?? 0} points and ${hit.num_comments ?? 0} comments on Hacker News.`,
        500,
      ),
      content: stripHtml(hit.story_text ?? "").slice(0, 3000),
      sourceName: "Hacker News",
      sourceType: "HN",
      company: {
        name: companyName,
        confidence: extracted?.confidence ?? 0.64,
        domain,
        website: externalUrl ?? null,
      },
      signalHints: config.tags === "show_hn" ? ["PRODUCT_LAUNCH"] : [],
      tags: hit._tags ?? [],
      metadata: {
        hnId: hit.objectID,
        points: hit.points ?? 0,
        comments: hit.num_comments ?? 0,
        externalUrl,
        author: hit.author,
      },
    });
  }

  return { documents, warnings };
}

export const hnConnector: SourceConnector<HnConfig> = {
  kind: "HN",
  label: "Hacker News launch radar",
  description: "Uses the public Hacker News Algolia API to find public Show HN launches and startup announcements.",
  configSchema: hnConfigSchema,
  docs: "Search public Hacker News stories by keyword. Show HN posts are treated as product-launch signals. Link always points to the HN item.",
  async fetch(config, context): Promise<ConnectorResult> {
    const cutoff = Math.floor(new Date(context.now.getTime() - 180 * 86_400_000).getTime() / 1000);
    const params = new URLSearchParams({
      query: config.query,
      tags: config.tags,
      hitsPerPage: String(config.maxItems),
      numericFilters: `created_at_i>${cutoff},points>=${config.minPoints}`,
    });
    const result = await safeFetch(`https://hn.algolia.com/api/v1/search_by_date?${params.toString()}`, {
      timeoutMs: 10_000,
    });
    const json = JSON.parse(result.text) as { hits?: HnHit[] };
    const parsed = parseHnHits(json.hits ?? [], config);
    return {
      documents: parsed.documents,
      warnings: parsed.warnings,
      attribution: "Hacker News (Algolia public API)",
    };
  },
};
