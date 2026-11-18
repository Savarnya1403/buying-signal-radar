import type { SourceType } from "@prisma/client";
import { z } from "zod";
import { hnConnector, hnConfigSchema } from "./hn";
import { jobFeedConnector, jobFeedConfigSchema } from "./job-feed";
import { rssConnector, rssConfigSchema } from "./rss";
import { urlConnector, urlConfigSchema } from "./url";
import { websiteConnector, websiteConfigSchema } from "./url";
import { webSearchConnector, webSearchConfigSchema } from "./web-search";
import { directoryWatchlist, isIndiaTarget } from "./company-directory";
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

export function buildDefaultSources(icp: ConnectorIcp): DefaultSource[] {  const focus = [icp.productCategory, icp.targetIndustries[0]].filter(Boolean).join(" ");
  const role = icp.buyerRoles[0]?.replace(/\s*\/.*$/, "") ?? icp.targetIndustries[0] ?? "sales";
  const query = focus.trim().split(/\s+/).slice(0, 6).join(" ") || "B2B software";
  const industry = icp.targetIndustries[0];
  const tag = industry ? INDUSTRY_FEED_TAGS[industry] : undefined;

  // India-targeted ICPs get India-only sources. Fetching US startup feeds and
  // then trying to filter them afterwards is what produced unrelated leads.
  if (isIndiaTarget(icp.geographies)) {
    const indiaSources: DefaultSource[] = [
      {
        type: "RSS",
        name: "Inc42 · Indian startups",
        url: "https://inc42.com/feed/",
        config: { feedUrl: "https://inc42.com/feed/", region: "India", maxItems: 20 },
        description: "India-only startup, funding and product coverage. Companies covered here are part of the Indian market.",
      },
      {
        type: "RSS",
        name: "YourStory · Indian founders",
        url: "https://yourstory.com/feed",
        config: { feedUrl: "https://yourstory.com/feed", region: "India", maxItems: 20 },
        description: "India-only founder and startup stories with public funding and launch evidence.",
      },
      {
        type: "RSS",
        name: "Economic Times · India tech",
        url: "https://economictimes.indiatimes.com/tech/rssfeeds/13357270.cms",
        config: { feedUrl: "https://economictimes.indiatimes.com/tech/rssfeeds/13357270.cms", region: "India", maxItems: 20 },
        description: "Indian technology and business coverage, including funding, expansion and leadership changes.",
      },
      {
        type: "RSS",
        name: "TechCrunch · India coverage",
        url: "https://techcrunch.com/tag/india/feed/",
        config: { feedUrl: "https://techcrunch.com/tag/india/feed/", region: "India", maxItems: 20 },
        description: "TechCrunch stories tagged India, matched to the Indian market you asked for.",
      },
      {
        type: "RSS",
        name: "Google News · India startup funding",
        url: "https://news.google.com/rss/search?q=India+startup+funding&hl=en-IN&gl=IN&ceid=IN%3Aen",
        config: {
          feedUrl: "https://news.google.com/rss/search?q=India+startup+funding&hl=en-IN&gl=IN&ceid=IN%3Aen",
          region: "India",
          maxItems: 25,
        },
        description: "Public Google News RSS query for India startup funding, with every item linked to the original publisher.",
      },
    ];

    if (industry) {
      const params = new URLSearchParams({
        q: `India ${industry} startup (funding OR hiring OR launches OR expansion)`,
        hl: "en-IN",
        gl: "IN",
        ceid: "IN:en",
      });
      const feedUrl = `https://news.google.com/rss/search?${params.toString()}`;
      indiaSources.push({
        type: "RSS",
        name: "Google News · India industry news",
        url: feedUrl,
        config: { feedUrl, region: "India", maxItems: 25 },
        description: `Public Google News RSS query for Indian ${industry.toLowerCase()} companies, matched to the first target industry on your ICP.`,
      });
    }

    const watchlist = directoryWatchlist(icp);
    if (watchlist.length > 0) {
      indiaSources.push({
        type: "JOB_FEED",
        name: "Hiring watchlist · India companies",
        url: null,
        config: {
          provider: "auto",
          entries: watchlist.map((entry) => ({
            domain: entry.domain,
            companyName: entry.companyName,
            ...(entry.provider && entry.boardToken ? { provider: entry.provider, boardToken: entry.boardToken } : {}),
          })),
          maxItems: 24,
        },
        description:
          "Verified public Greenhouse, Lever and Ashby boards for Indian companies that match your target industry. Their industry and primary India location come from a checked company directory, not from job wording.",
      });
    }

    if (process.env.TAVILY_API_KEY || process.env.BRAVE_SEARCH_API_KEY) {
      indiaSources.push({
        type: "WEB_SEARCH",
        name: "Authorised web search · India",
        url: null,
        config: {
          provider: process.env.TAVILY_API_KEY ? "tavily" : "brave",
          query: `${query} India startup (funding OR hiring OR launches OR expansion)`,
          maxResults: 8,
        },
        description: "Runs a small number of India-focused queries through your configured search API.",
      });
    }

    return indiaSources;
  }

  const sources: DefaultSource[] = [
    {
      type: "RSS",
      name: "TechCrunch · Startup news",
      url: "https://techcrunch.com/category/startups/feed/",
      config: { feedUrl: "https://techcrunch.com/category/startups/feed/", region: "United States", maxItems: 20 },
      description: "Public startup funding, launch and leadership headlines with a link to every article.",
    },
    {
      type: "RSS",
      name: "TechCrunch · Venture & funding",
      url: "https://techcrunch.com/category/venture/feed/",
      config: { feedUrl: "https://techcrunch.com/category/venture/feed/", region: "United States", maxItems: 20 },
      description: "Public funding rounds and investor coverage — the strongest early signal that headcount is about to grow.",
    },
  ];

  if (tag) {
    sources.push({
      type: "RSS",
      name: `TechCrunch · ${industry} coverage`,
      url: `https://techcrunch.com/tag/${tag}/feed/`,
      config: { feedUrl: `https://techcrunch.com/tag/${tag}/feed/`, region: "United States", maxItems: 20 },
      description: `Public ${industry.toLowerCase()} coverage from TechCrunch, matched to the first target industry on your ICP.`,
    });
  }

  sources.push(
    {
      type: "RSS",
      name: "Tech.eu · European startups",
      url: "https://tech.eu/feed/",
      config: { feedUrl: "https://tech.eu/feed/", region: "Europe", maxItems: 20 },
      description: "Public European startup funding and expansion news, including rounds outside the US.",
    },
    {
      type: "RSS",
      name: "Crunchbase News · Funding",
      url: "https://news.crunchbase.com/feed/",
      config: { feedUrl: "https://news.crunchbase.com/feed/", region: "United States", maxItems: 15 },
      description: "Public funding-round reporting with named companies and round sizes.",
    },
    {
      type: "HN",
      name: "Hacker News · Funding chatter",
      url: "https://news.ycombinator.com/",
      config: { query: "raises", tags: "story", minPoints: 5, region: "United States", maxItems: 15 },
      description: "Public Hacker News stories about companies raising money, matched by the Algolia API.",
    },
    {
      type: "HN",
      name: "Hacker News · Show HN launches",
      url: "https://news.ycombinator.com/",
      config: { query: "", tags: "show_hn", minPoints: 2, region: "United States", maxItems: 15 },
      description: "Public Show HN launch posts from the Hacker News Algolia API, matched to your product category.",
    },
  );

  // Remotive and Jobicy are global remote boards: they rarely state an
  // employer's HQ, so they add noise (and fetch time) to a country-specific ICP.
  // Keep them for global searches and for users who add them explicitly.
  if (icp.geographies.length === 0 || icp.geographies.includes("Remote / global")) {
    sources.push(
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
  }

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

const MANAGED_DEFAULT_PREFIXES = [
  "TechCrunch ·",
  "Tech.eu ·",
  "Crunchbase News ·",
  "Hacker News ·",
  "Remotive ·",
  "Jobicy ·",
  "Inc42 ·",
  "YourStory ·",
  "Economic Times ·",
  "Hiring watchlist ·",
  "Authorised web search",
];

/**
 * True for sources this product creates automatically. When an ICP changes
 * geography or industry, stale managed defaults are disabled so they do not
 * keep fetching an unrelated market. User-created sources are never touched.
 */
export function isManagedDefaultSourceName(name: string): boolean {
  return MANAGED_DEFAULT_PREFIXES.some((prefix) => name.startsWith(prefix));
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
