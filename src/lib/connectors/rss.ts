import { z } from "zod";
import Parser from "rss-parser";
import { safeFetch } from "@/lib/http/safe-fetch";
import { extractCompanyFromHeadline, cleanSourceName, stripHtml, truncateEvidence } from "./extraction";
import type { ConnectorResult, RawDocument, SourceConnector } from "./types";

export const rssConfigSchema = z.object({
  feedUrl: z.string().url().max(2000),
  companyHint: z.string().trim().max(160).optional(),
  companyDomain: z.string().trim().max(255).optional(),
  maxItems: z.number().int().min(1).max(50).optional(),
});

export type RssConfig = z.infer<typeof rssConfigSchema>;

type FeedItemShape = {
  title?: string;
  link?: string;
  isoDate?: string;
  pubDate?: string;
  contentSnippet?: string;
  content?: string;
  summary?: string;
  categories?: string[];
};

export function parseRssItems(
  items: FeedItemShape[],
  config: RssConfig,
  feed: { title?: string; link?: string },
): { documents: RawDocument[]; warnings: string[] } {
  const documents: RawDocument[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const item of items.slice(0, config.maxItems ?? 25)) {
    const title = stripHtml(item.title ?? "").trim();
    const url = item.link?.trim();
    if (!title || !url || seen.has(url)) continue;
    seen.add(url);

    const summary = truncateEvidence(item.contentSnippet || item.summary || item.content || "", 600);
    let companyName = config.companyHint?.trim();
    let confidence = config.companyHint ? 0.95 : 0;
    let pattern = "configured-company";

    if (!companyName) {
      const extracted = extractCompanyFromHeadline(title);
      if (extracted) {
        companyName = extracted.name;
        confidence = extracted.confidence;
        pattern = extracted.pattern;
      }
    }

    if (!companyName || confidence < 0.45) {
      warnings.push(`Skipped “${title.slice(0, 90)}” — could not identify a company confidently.`);
      continue;
    }

    documents.push({
      title,
      url,
      publishedAt: item.isoDate ? new Date(item.isoDate) : item.pubDate ? new Date(item.pubDate) : null,
      summary: summary || title,
      content: stripHtml(item.content ?? "").slice(0, 6000),
      sourceName: cleanSourceName(feed.title ?? new URL(config.feedUrl).hostname),
      sourceType: "RSS",
      company: {
        name: companyName,
        confidence,
        domain: config.companyDomain ?? null,
        website: config.companyDomain ? `https://${config.companyDomain.replace(/^https?:\/\//, "")}` : null,
      },
      tags: item.categories ?? [],
      metadata: { feedUrl: config.feedUrl, feedLink: feed.link, extractionPattern: pattern },
    });
  }

  return { documents, warnings };
}

export const rssConnector: SourceConnector<RssConfig> = {
  kind: "RSS",
  label: "RSS / Atom feed",
  description: "Monitor public news, company blogs and press-release feeds. Headlines are attributed and linked.",
  configSchema: rssConfigSchema,
  docs: "Provide a public RSS or Atom URL. Optionally pin a company hint when every item belongs to one company.",
  async fetch(config): Promise<ConnectorResult> {
    const result = await safeFetch(config.feedUrl, { timeoutMs: 12_000 });
    const parser = new Parser({ customFields: { item: ["summary", "content:encoded"] } });
    const feed = await parser.parseString(result.text);
    const parsed = parseRssItems(feed.items as FeedItemShape[], config, { title: feed.title, link: feed.link });
    return { documents: parsed.documents, warnings: parsed.warnings, attribution: feed.title };
  },
};
