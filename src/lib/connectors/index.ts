import type { SourceType } from "@prisma/client";
import { z } from "zod";
import { hnConnector, hnConfigSchema } from "./hn";
import { jobFeedConnector, jobFeedConfigSchema } from "./job-feed";
import { rssConnector, rssConfigSchema } from "./rss";
import { urlConnector, urlConfigSchema } from "./url";
import { websiteConnector, websiteConfigSchema } from "./url";
import { webSearchConnector, webSearchConfigSchema } from "./web-search";
import type { ConnectorIcp, ConnectorResult, SourceConnector } from "./types";

export const CONNECTORS: Record<SourceType, SourceConnector> = {
  RSS: rssConnector as SourceConnector,
  URL: urlConnector as SourceConnector,
  WEBSITE: websiteConnector as SourceConnector,
  JOB_FEED: jobFeedConnector as SourceConnector,
  WEB_SEARCH: webSearchConnector as SourceConnector,
  HN: hnConnector as SourceConnector,
};

export const CONNECTOR_SCHEMAS = {
  RSS: rssConfigSchema,
  URL: urlConfigSchema,
  WEBSITE: websiteConfigSchema,
  JOB_FEED: jobFeedConfigSchema,
  WEB_SEARCH: webSearchConfigSchema,
  HN: hnConfigSchema,
} as const;

export function parseSourceConfig(kind: SourceType, config: unknown) {
  const schema = CONNECTOR_SCHEMAS[kind] as z.ZodTypeAny;
  return schema.safeParse(config);
}

export function runConnector(kind: SourceType, config: unknown, icp: ConnectorIcp, now = new Date()): Promise<ConnectorResult> {
  const connector = CONNECTORS[kind];
  if (!connector) throw new Error(`Unknown connector type: ${kind}`);
  const parsed = parseSourceConfig(kind, config);
  if (!parsed.success) {
    throw new Error(`Invalid ${connector.label} configuration: ${parsed.error.issues[0]?.message ?? "unknown error"}`);
  }
  return connector.fetch(parsed.data, { icp, now });
}

export type DefaultSource = {
  type: SourceType;
  name: string;
  url: string | null;
  config: Record<string, unknown>;
  description: string;
};

const INDUSTRY_FEED_TAGS: Record<string, string> = {
  "B2B SaaS": "saas",
  Fintech: "fintech",
  "Developer tools": "developer-tools",
  Healthtech: "health-tech",
  "E-commerce": "ecommerce",
  Logistics: "logistics",
  Cybersecurity: "cybersecurity",
  "AI / ML": "artificial-intelligence",
  "Climate tech": "climate",
  Manufacturing: "enterprise",
  "Marketing technology": "martech",
  "HR technology": "hr-tech",
  "Real estate": "real-estate",
  Education: "education",
  "Travel & hospitality": "travel",
  "Media & entertainment": "media",
  Insurtech: "insurtech",
  Retail: "retail",
  Telecom: "telecom",
  Biotech: "biotech",
};

export function buildDefaultSources(icp: ConnectorIcp): DefaultSource[] {
  const focus = [icp.productCategory, icp.targetIndustries[0]].filter(Boolean).join(" ");
  const role = icp.buyerRoles[0]?.replace(/\s*\/.*$/, "") ?? icp.targetIndustries[0] ?? "sales";
  const query = focus.trim().split(/\s+/).slice(0, 6).join(" ") || "B2B software";
  const industry = icp.targetIndustries[0];
  const tag = industry ? INDUSTRY_FEED_TAGS[industry] : undefined;

  const sources: DefaultSource[] = [
    {
      type: "RSS",
      name: "TechCrunch · Startup news",
      url: "https://techcrunch.com/category/startups/feed/",
      config: { feedUrl: "https://techcrunch.com/category/startups/feed/", maxItems: 20 },
      description: "Public startup funding, launch and leadership headlines with a link to every article.",
    },
    {
      type: "RSS",
      name: "TechCrunch · Venture & funding",
      url: "https://techcrunch.com/category/venture/feed/",
      config: { feedUrl: "https://techcrunch.com/category/venture/feed/", maxItems: 20 },
      description: "Public funding rounds and investor coverage — the strongest early signal that headcount is about to grow.",
    },
  ];

  if (tag) {
    sources.push({
      type: "RSS",
      name: `TechCrunch · ${industry} coverage`,
      url: `https://techcrunch.com/tag/${tag}/feed/`,
      config: { feedUrl: `https://techcrunch.com/tag/${tag}/feed/`, maxItems: 20 },
      description: `Public ${industry.toLowerCase()} coverage from TechCrunch, matched to the first target industry on your ICP.`,
    });
  }

  sources.push(
    {
      type: "RSS",
      name: "Tech.eu · European startups",
      url: "https://tech.eu/feed/",
      config: { feedUrl: "https://tech.eu/feed/", maxItems: 20 },
      description: "Public European startup funding and expansion news, including rounds outside the US.",
    },
    {
      type: "RSS",
      name: "Crunchbase News · Funding",
      url: "https://news.crunchbase.com/feed/",
      config: { feedUrl: "https://news.crunchbase.com/feed/", maxItems: 15 },
      description: "Public funding-round reporting with named companies and round sizes.",
    },
    {
      type: "HN",
      name: "Hacker News · Funding chatter",
      url: "https://news.ycombinator.com/",
      config: { query: "raises", tags: "story", minPoints: 5, maxItems: 15 },
      description: "Public Hacker News stories about companies raising money, matched by the Algolia API.",
    },
    {
      type: "HN",
      name: "Hacker News · Show HN launches",
      url: "https://news.ycombinator.com/",
      config: { query: "", tags: "show_hn", minPoints: 2, maxItems: 15 },
      description: "Public Show HN launch posts from the Hacker News Algolia API, matched to your product category.",
    },
    {
      type: "JOB_FEED",
      name: "Remotive · Hiring search",
      url: "https://remotive.com/",
      config: { provider: "remotive", query: role, maxItems: 15 },
      description: "Public remote-job listings matching a buyer role or industry. Attribution and listing links are preserved.",
    },
    {
      type: "JOB_FEED",
      name: "Jobicy · Hiring tag",
      url: "https://jobicy.com/",
      config: { provider: "jobicy", tag: (industry ?? role).toLowerCase().slice(0, 40), maxItems: 15 },
      description: "Public Jobicy feed for the closest industry tag, useful for companies hiring outside the remote-first bubble.",
    },
  );

  if (process.env.TAVILY_API_KEY || process.env.BRAVE_SEARCH_API_KEY) {
    sources.push({
      type: "WEB_SEARCH",
      name: "Authorised web search",
      url: null,
      config: {
        provider: process.env.TAVILY_API_KEY ? "tavily" : "brave",
        query: `${query} startup (funding OR hiring OR launches OR expansion)`,
        maxResults: 8,
      },
      description: "Runs a small number of targeted queries through your configured search API.",
    });
  }

  return sources;
}

export const CONNECTOR_CATALOG = [
  {
    type: "RSS" as const,
    label: rssConnector.label,
    description: rssConnector.description,
    permission: "Public feeds intended for syndication. Links and attribution preserved.",
    example: "https://techcrunch.com/category/startups/feed/",
    available: true,
  },
  {
    type: "URL" as const,
    label: urlConnector.label,
    description: urlConnector.description,
    permission: "A page the user explicitly submits. robots.txt and SSRF protections applied.",
    example: "https://example.com/press/announcement",
    available: true,
  },
  {
    type: "WEBSITE" as const,
    label: websiteConnector.label,
    description: websiteConnector.description,
    permission: "Company-owned public pages only. No logins, paywalls or anti-bot bypass.",
    example: "https://example.com",
    available: true,
  },
  {
    type: "JOB_FEED" as const,
    label: jobFeedConnector.label,
    description: jobFeedConnector.description,
    permission: "Public job-board APIs and ATS feeds with attribution. No LinkedIn scraping.",
    example: "Remotive search, Jobicy tag, or a domain watchlist that auto-detects Greenhouse, Lever or Ashby",
    available: true,
  },
  {
    type: "WEB_SEARCH" as const,
    label: webSearchConnector.label,
    description: webSearchConnector.description,
    permission: "Only official Tavily or Brave Search APIs with your key. No SERP scraping.",
    example: "Needs TAVILY_API_KEY or BRAVE_SEARCH_API_KEY",
    available: Boolean(process.env.TAVILY_API_KEY || process.env.BRAVE_SEARCH_API_KEY),
  },
  {
    type: "HN" as const,
    label: hnConnector.label,
    description: hnConnector.description,
    permission: "Public Hacker News Algolia API. Discussion link preserved as provenance.",
    example: "Show HN + your product category",
    available: true,
  },
];
