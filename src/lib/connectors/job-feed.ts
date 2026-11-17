import { z } from "zod";
import { safeFetch } from "@/lib/http/safe-fetch";
import { normalizeCompanyName, parseDate, stripHtml, truncateEvidence } from "./extraction";
import { companyNameFromDomain, detectAts, normalizeDomain, type AtsBoard } from "./ats";
import { parseRssItems } from "./rss";
import Parser from "rss-parser";
import type { ConnectorResult, RawDocument, SourceConnector } from "./types";

const remotiveSchema = z.object({
  provider: z.literal("remotive"),
  query: z.string().trim().min(2).max(160),
  maxItems: z.number().int().min(1).max(30).default(12),
});
const jobicySchema = z.object({
  provider: z.literal("jobicy"),
  tag: z.string().trim().min(2).max(80).optional(),
  geo: z.string().trim().max(40).optional(),
  maxItems: z.number().int().min(1).max(30).default(12),
});
const greenhouseSchema = z.object({
  provider: z.literal("greenhouse"),
  boardToken: z.string().trim().min(1).max(80),
  companyName: z.string().trim().min(1).max(160),
  companyDomain: z.string().trim().max(255).optional(),
  maxItems: z.number().int().min(1).max(30).default(12),
});
const leverSchema = z.object({
  provider: z.literal("lever"),
  boardToken: z.string().trim().min(1).max(80),
  companyName: z.string().trim().min(1).max(160),
  companyDomain: z.string().trim().max(255).optional(),
  maxItems: z.number().int().min(1).max(30).default(12),
});
const rssJobSchema = z.object({
  provider: z.literal("rss"),
  feedUrl: z.string().url().max(2000),
  companyHint: z.string().trim().min(1).max(160).optional(),
  companyDomain: z.string().trim().max(255).optional(),
  maxItems: z.number().int().min(1).max(30).default(12),
});
const ashbySchema = z.object({
  provider: z.literal("ashby"),
  boardToken: z.string().trim().min(1).max(80),
  companyName: z.string().trim().min(1).max(160),
  companyDomain: z.string().trim().max(255).optional(),
  maxItems: z.number().int().min(1).max(30).default(12),
});
const autoSchema = z.object({
  provider: z.literal("auto"),
  domains: z.array(z.string().trim().min(3).max(255)).min(1).max(8),
  maxItems: z.number().int().min(1).max(40).default(10),
});

export const jobFeedConfigSchema = z.discriminatedUnion("provider", [
  remotiveSchema,
  jobicySchema,
  greenhouseSchema,
  leverSchema,
  ashbySchema,
  autoSchema,
  rssJobSchema,
]);

export type JobFeedConfig = z.infer<typeof jobFeedConfigSchema>;

type RemotiveJob = {
  id?: number;
  url?: string;
  title?: string;
  company_name?: string;
  category?: string;
  tags?: string[];
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  description?: string;
};

function recentFirst(a: { publishedAt?: Date | null }, b: { publishedAt?: Date | null }): number {
  return (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0);
}

export function parseRemotiveJobs(jobs: RemotiveJob[], maxItems: number): RawDocument[] {
  const dated = jobs.map((job) => ({ ...job, publishedAt: parseDate(job.publication_date) }));
  return dated.sort(recentFirst).slice(0, maxItems).flatMap((job) => {
    if (!job.title || !job.company_name) return [];
    const url = job.url ?? `https://remotive.com/remote-jobs/${job.id}`;
    return [{
      title: `${job.title} at ${normalizeCompanyName(job.company_name)}`,
      url,
      publishedAt: job.publishedAt ?? null,
      summary: truncateEvidence(
        `Hiring for ${job.title}${job.candidate_required_location ? ` · ${job.candidate_required_location}` : ""}${job.job_type ? ` · ${job.job_type.replace("_", " ")}` : ""}`,
        320,
      ),
      content: stripHtml(job.description ?? "").slice(0, 5000),
      sourceName: "Remotive",
      sourceType: "JOB_FEED",
      company: {
        name: normalizeCompanyName(job.company_name),
        confidence: 0.95,
        location: job.candidate_required_location ?? null,
        description: stripHtml(job.description ?? "").slice(0, 800),
      },
      signalHints: ["HIRING"],
      tags: job.tags ?? [],
      metadata: { provider: "remotive", jobId: job.id, jobTitle: job.title, category: job.category },
    } satisfies RawDocument];
  });
}

type JobicyJob = {
  id?: number;
  url?: string;
  jobTitle?: string;
  companyName?: string;
  jobIndustry?: string[];
  jobType?: string[];
  jobGeo?: string;
  jobLevel?: string;
  jobExcerpt?: string;
  jobDescription?: string;
  pubDate?: string;
};

export function parseJobicyJobs(jobs: JobicyJob[], maxItems: number): RawDocument[] {
  const dated = jobs.map((job) => ({ ...job, publishedAt: parseDate(job.pubDate) }));
  return dated.sort(recentFirst).slice(0, maxItems).flatMap((job) => {
    if (!job.jobTitle || !job.companyName) return [];
    const url = job.url ?? `https://jobicy.com/jobs/${job.id}`;
    return [{
      title: `${job.jobTitle} at ${normalizeCompanyName(job.companyName)}`,
      url,
      publishedAt: job.publishedAt ?? null,
      summary: truncateEvidence(
        `Hiring for ${job.jobTitle}${job.jobGeo ? ` · ${job.jobGeo}` : ""}${job.jobLevel ? ` · ${job.jobLevel}` : ""}`,
        320,
      ),
      content: stripHtml(job.jobDescription ?? job.jobExcerpt ?? "").slice(0, 5000),
      sourceName: "Jobicy",
      sourceType: "JOB_FEED",
      company: {
        name: normalizeCompanyName(job.companyName),
        confidence: 0.94,
        location: job.jobGeo ?? null,
        description: truncateEvidence(job.jobExcerpt ?? "", 800),
      },
      signalHints: ["HIRING"],
      tags: job.jobIndustry ?? [],
      metadata: { provider: "jobicy", jobId: job.id, jobTitle: job.jobTitle, level: job.jobLevel },
    } satisfies RawDocument];
  });
}

type GreenhouseJob = {
  id?: number;
  title?: string;
  absolute_url?: string;
  updated_at?: string;
  location?: { name?: string };
  content?: string;
};

export function parseGreenhouseJobs(
  jobs: GreenhouseJob[],
  config: { companyName: string; companyDomain?: string; maxItems: number },
): RawDocument[] {
  const dated = jobs.map((job) => ({ ...job, publishedAt: parseDate(job.updated_at) }));
  return dated.sort(recentFirst).slice(0, config.maxItems).flatMap((job) => {
    if (!job.title || !job.absolute_url) return [];
    return [{
      title: `${job.title} at ${config.companyName}`,
      url: job.absolute_url,
      publishedAt: job.publishedAt ?? null,
      summary: truncateEvidence(`Open role: ${job.title}${job.location?.name ? ` · ${job.location.name}` : ""}`, 320),
      content: stripHtml(job.content ?? "").slice(0, 5000),
      sourceName: `Greenhouse · ${config.companyName}`,
      sourceType: "JOB_FEED",
      company: {
        name: config.companyName,
        confidence: 1,
        domain: config.companyDomain ?? null,
        website: config.companyDomain ? `https://${config.companyDomain.replace(/^https?:\/\//, "")}` : null,
        location: job.location?.name ?? null,
      },
      signalHints: ["HIRING"],
      metadata: { provider: "greenhouse", jobId: job.id, jobTitle: job.title },
    } satisfies RawDocument];
  });
}

type LeverJob = {
  id?: string;
  text?: string;
  hostedUrl?: string;
  createdAt?: number;
  categories?: { location?: string; team?: string; commitment?: string };
  descriptionPlain?: string;
  additionalPlain?: string;
};

export function parseLeverJobs(
  jobs: LeverJob[],
  config: { companyName: string; companyDomain?: string; maxItems: number },
): RawDocument[] {
  const dated = jobs.map((job) => ({ ...job, publishedAt: job.createdAt ? new Date(job.createdAt) : null }));
  return dated.sort(recentFirst).slice(0, config.maxItems).flatMap((job) => {
    if (!job.text || !job.hostedUrl) return [];
    return [{
      title: `${job.text} at ${config.companyName}`,
      url: job.hostedUrl,
      publishedAt: job.publishedAt ?? null,
      summary: truncateEvidence(`Open role: ${job.text}${job.categories?.location ? ` · ${job.categories.location}` : ""}`, 320),
      content: stripHtml(`${job.descriptionPlain ?? ""} ${job.additionalPlain ?? ""}`).slice(0, 5000),
      sourceName: `Lever · ${config.companyName}`,
      sourceType: "JOB_FEED",
      company: {
        name: config.companyName,
        confidence: 1,
        domain: config.companyDomain ?? null,
        website: config.companyDomain ? `https://${config.companyDomain.replace(/^https?:\/\//, "")}` : null,
        location: job.categories?.location ?? null,
      },
      signalHints: ["HIRING"],
      metadata: { provider: "lever", jobId: job.id, jobTitle: job.text },
    } satisfies RawDocument];
  });
}

type AshbyJob = {
  id?: string;
  title?: string;
  department?: string;
  location?: string;
  employmentType?: string;
  publishedAt?: string;
  isListed?: boolean;
  isRemote?: boolean;
  jobUrl?: string;
  descriptionPlain?: string;
};

export function parseAshbyJobs(
  jobs: AshbyJob[],
  config: { companyName: string; companyDomain?: string; maxItems: number },
): RawDocument[] {
  return jobs
    .map((job) => ({ ...job, publishedAt: parseDate(job.publishedAt) }))
    .filter((job) => job.isListed !== false)
    .sort(recentFirst)
    .slice(0, config.maxItems)
    .flatMap((job) => {
      if (!job.title || !job.jobUrl) return [];
      return [{
        title: `${job.title} at ${config.companyName}`,
        url: job.jobUrl,
        publishedAt: job.publishedAt ?? null,
        summary: truncateEvidence(
          `Open role: ${job.title}${job.location ? ` · ${job.location}` : ""}${job.department ? ` · ${job.department}` : ""}`,
          320,
        ),
        content: stripHtml(job.descriptionPlain ?? "").slice(0, 5000),
        sourceName: `Ashby · ${config.companyName}`,
        sourceType: "JOB_FEED",
        company: {
          name: config.companyName,
          confidence: 1,
          domain: config.companyDomain ?? null,
          website: config.companyDomain ? `https://${config.companyDomain.replace(/^https?:\/\//, "")}` : null,
          location: job.location ?? null,
        },
        signalHints: ["HIRING"],
        tags: job.department ? [job.department] : [],
        metadata: { provider: "ashby", jobId: job.id, jobTitle: job.title, remote: job.isRemote ?? false },
      } satisfies RawDocument];
    });
}

async function fetchBoardJobs(board: AtsBoard, domain: string, maxItems: number): Promise<RawDocument[]> {
  const companyName = board.companyName?.trim() || companyNameFromDomain(domain);
  const companyDomain = domain;

  if (board.provider === "greenhouse") {
    const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board.token)}/jobs?content=true`;
    const result = await safeFetch(url, { timeoutMs: 10_000 });
    const json = JSON.parse(result.text) as { jobs?: GreenhouseJob[] };
    return parseGreenhouseJobs(json.jobs ?? [], { companyName, companyDomain, maxItems });
  }

  if (board.provider === "lever") {
    const url = `https://api.lever.co/v0/postings/${encodeURIComponent(board.token)}?mode=json`;
    const result = await safeFetch(url, { timeoutMs: 10_000 });
    return parseLeverJobs(JSON.parse(result.text) as LeverJob[], { companyName, companyDomain, maxItems });
  }

  const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board.token)}?includeCompensation=false`;
  const result = await safeFetch(url, { timeoutMs: 10_000 });
  const json = JSON.parse(result.text) as { jobs?: AshbyJob[] };
  return parseAshbyJobs(json.jobs ?? [], { companyName, companyDomain, maxItems });
}

export const jobFeedConnector: SourceConnector<JobFeedConfig> = {
  kind: "JOB_FEED",
  label: "Public job feeds",
  description:
    "Read public job-board APIs and ATS feeds (Remotive, Jobicy, Greenhouse, Lever) to detect hiring signals with role and location evidence.",
  configSchema: jobFeedConfigSchema,
  docs: "Run a keyword search on Remotive, a Jobicy tag, point at a specific Greenhouse/Lever/Ashby board, or give a list of company domains and let the connector find their public careers board automatically. Only public ATS APIs and company careers pages are read; every signal keeps a direct link to the listing.",
  async fetch(config): Promise<ConnectorResult> {
    if (config.provider === "remotive") {
      const params = new URLSearchParams({ search: config.query, limit: String(config.maxItems) });
      const result = await safeFetch(`https://remotive.com/api/remote-jobs?${params.toString()}`, { timeoutMs: 12_000 });
      const json = JSON.parse(result.text) as { jobs?: RemotiveJob[] };
      return { documents: parseRemotiveJobs(json.jobs ?? [], config.maxItems), warnings: [], attribution: "Remotive public API" };
    }

    if (config.provider === "jobicy") {
      const params = new URLSearchParams({ count: String(config.maxItems) });
      if (config.tag) params.set("tag", config.tag);
      if (config.geo) params.set("geo", config.geo);
      const result = await safeFetch(`https://jobicy.com/api/v2/remote-jobs?${params.toString()}`, { timeoutMs: 12_000 });
      const json = JSON.parse(result.text) as { jobs?: JobicyJob[] };
      return { documents: parseJobicyJobs(json.jobs ?? [], config.maxItems), warnings: [], attribution: "Jobicy public API" };
    }

    if (config.provider === "greenhouse") {
      const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(config.boardToken)}/jobs?content=true`;
      const result = await safeFetch(url, { timeoutMs: 12_000 });
      const json = JSON.parse(result.text) as { jobs?: GreenhouseJob[] };
      return {
        documents: parseGreenhouseJobs(json.jobs ?? [], config),
        warnings: [],
        attribution: `Greenhouse public job board for ${config.companyName}`,
      };
    }

    if (config.provider === "lever") {
      const url = `https://api.lever.co/v0/postings/${encodeURIComponent(config.boardToken)}?mode=json`;
      const result = await safeFetch(url, { timeoutMs: 12_000 });
      const json = JSON.parse(result.text) as LeverJob[];
      return {
        documents: parseLeverJobs(json, config),
        warnings: [],
        attribution: `Lever public job board for ${config.companyName}`,
      };
    }

    if (config.provider === "ashby") {
      const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(config.boardToken)}?includeCompensation=false`;
      const result = await safeFetch(url, { timeoutMs: 12_000 });
      const json = JSON.parse(result.text) as { jobs?: AshbyJob[] };
      return {
        documents: parseAshbyJobs(json.jobs ?? [], config),
        warnings: [],
        attribution: `Ashby public job board for ${config.companyName}`,
      };
    }

    if (config.provider === "auto") {
      const documents: RawDocument[] = [];
      const warnings: string[] = [];
      const seenBoards = new Set<string>();
      const perCompany = Math.max(3, Math.ceil(config.maxItems / Math.min(config.domains.length, 4)));

      const resolved = await Promise.all(
        config.domains.map(async (input) => {
          const domain = normalizeDomain(input);
          if (!domain) return { input, domain: null, board: null as AtsBoard | null };
          try {
            return { input, domain, board: await detectAts(domain) };
          } catch {
            return { input, domain, board: null as AtsBoard | null };
          }
        }),
      );

      for (const entry of resolved) {
        if (!entry.domain) {
          warnings.push(`“${entry.input}” is not a valid public domain.`);
          continue;
        }
        if (!entry.board) {
          warnings.push(`No public Greenhouse, Lever or Ashby board found for ${entry.domain}. Add the board token as a specific source instead.`);
          continue;
        }
        const key = `${entry.board.provider}:${entry.board.token}`;
        if (seenBoards.has(key)) continue;
        seenBoards.add(key);
        try {
          const jobs = await fetchBoardJobs(entry.board, entry.domain, perCompany);
          if (jobs.length === 0) {
            warnings.push(`${entry.domain} has a public ${entry.board.provider} board, but no open roles were listed.`);
          }
          documents.push(...jobs);
        } catch {
          warnings.push(`Could not read the ${entry.board.provider} board for ${entry.domain}.`);
        }
      }

      return {
        documents: documents.slice(0, config.maxItems),
        warnings,
        attribution: "Company careers pages and public ATS APIs (Greenhouse, Lever, Ashby)",
      };
    }

    const result = await safeFetch(config.feedUrl, { timeoutMs: 12_000 });
    const parser = new Parser({ customFields: { item: ["summary", "content:encoded"] } });
    const feed = await parser.parseString(result.text);
    const parsed = parseRssItems(
      feed.items as { title?: string; link?: string; isoDate?: string; pubDate?: string; contentSnippet?: string; content?: string }[],
      { feedUrl: config.feedUrl, companyHint: config.companyHint, companyDomain: config.companyDomain, maxItems: config.maxItems },
      { title: feed.title, link: feed.link },
    );
    for (const document of parsed.documents) {
      document.signalHints = ["HIRING"];
      document.sourceType = "JOB_FEED";
    }
    return { documents: parsed.documents, warnings: parsed.warnings, attribution: feed.title };
  },
};
