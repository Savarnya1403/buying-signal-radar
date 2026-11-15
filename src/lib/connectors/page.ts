import * as cheerio from "cheerio";
import { extractRolesFromText, normalizeCompanyName, parseDate, stripHtml } from "./extraction";

export type ExtractedPage = {
  title: string;
  description: string;
  text: string;
  siteName: string | null;
  publishedAt: Date | null;
  canonicalUrl: string | null;
  location: string | null;
  employeeCount: number | null;
  roles: string[];
  isCareersPage: boolean;
  organizationName: string | null;
  jsonLdTypes: string[];
};

function collectJsonLd($: cheerio.CheerioAPI): Record<string, unknown>[] {
  const items: Record<string, unknown>[] = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).contents().text();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const queue = Array.isArray(parsed) ? [...parsed] : [parsed];
      for (const entry of queue) {
        if (!entry || typeof entry !== "object") continue;
        if (Array.isArray((entry as Record<string, unknown>)["@graph"])) {
          queue.push(...((entry as Record<string, unknown>)["@graph"] as unknown[]).filter((item) => item && typeof item === "object"));
        }
        items.push(entry as Record<string, unknown>);
      }
    } catch {
      // Malformed structured data is common; ignore it rather than failing the page.
    }
  });
  return items.slice(0, 40);
}

function typeOf(item: Record<string, unknown>): string[] {
  const value = item["@type"];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === "string");
  return [];
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textOf).filter(Boolean).join(" ");
  if (value && typeof value === "object" && "name" in value) return textOf((value as Record<string, unknown>).name);
  return "";
}

export function extractPage(html: string, url: string): ExtractedPage {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe, form, nav, footer").remove();

  const meta = (selector: string) => $(selector).attr("content")?.trim() ?? "";
  const title =
    meta('meta[property="og:title"]') ||
    meta('meta[name="twitter:title"]') ||
    $("h1").first().text().trim() ||
    $("title").first().text().trim() ||
    "";

  const description =
    meta('meta[name="description"]') ||
    meta('meta[property="og:description"]') ||
    meta('meta[name="twitter:description"]') ||
    "";

  const siteName = meta('meta[property="og:site_name"]') || null;
  const bodyText = stripHtml($("body").text()).slice(0, 20_000);
  const jsonLd = collectJsonLd($);
  const jsonLdTypes = [...new Set(jsonLd.flatMap(typeOf))];

  const organization = jsonLd.find((item) => typeOf(item).some((type) => ["Organization", "Corporation", "LocalBusiness"].includes(type)));
  const article = jsonLd.find((item) => typeOf(item).some((type) => ["NewsArticle", "Article", "BlogPosting", "PressRelease"].includes(type)));
  const jobPosting = jsonLd.find((item) => typeOf(item).includes("JobPosting"));

  const organizationName = organization ? normalizeCompanyName(textOf(organization.name)) : null;

  const metaDate =
    meta('meta[property="article:published_time"]') ||
    meta('meta[name="article:published_time"]') ||
    meta('meta[name="date"]') ||
    meta('meta[name="publish-date"]') ||
    meta('meta[property="og:updated_time"]') ||
    $("time[datetime]").first().attr("datetime") ||
    "";

  const jsonDate = article ? textOf(article.datePublished) : "";
  const publishedAt = parseDate(metaDate) ?? parseDate(jsonDate);

  const address = organization?.address ?? jobPosting?.jobLocation;
  let location: string | null = null;
  if (address && typeof address === "object") {
    const record = address as Record<string, unknown>;
    const nested = record.address && typeof record.address === "object" ? (record.address as Record<string, unknown>) : record;
    location =
      [
        textOf(nested.addressLocality),
        textOf(nested.addressRegion),
        textOf(nested.addressCountry),
      ]
        .filter(Boolean)
        .join(", ") || null;
  }

  const employeeMatch = bodyText.match(/\b(\d{1,3}(?:,\d{3})*|\d+)\+?\s+(?:employees|people|team members|staff)\b/i);
  const employeeCount = employeeMatch ? Number(employeeMatch[1].replace(/,/g, "")) : null;

  const roles = extractRolesFromText(bodyText, 10);
  const path = (() => {
    try {
      return new URL(url).pathname.toLowerCase();
    } catch {
      return "";
    }
  })();
  const isCareersPage =
    /\/(careers?|jobs?|join-us|work-with-us|opportunities)(\/|$)/.test(path) ||
    jsonLdTypes.includes("JobPosting") ||
    /\b(open roles|open positions|join our team|we're hiring|current openings)\b/i.test(bodyText);

  return {
    title: title.slice(0, 300),
    description: description.slice(0, 800),
    text: bodyText,
    siteName,
    publishedAt,
    canonicalUrl: $('link[rel="canonical"]').attr("href") ?? null,
    location,
    employeeCount,
    roles,
    isCareersPage,
    organizationName,
    jsonLdTypes,
  };
}

export function companyNameFromPage(page: ExtractedPage, url: string): { name: string; confidence: number } {
  const candidates = [
    { value: page.organizationName, confidence: 0.9 },
    { value: page.siteName, confidence: 0.82 },
    { value: page.title.split(/\s*[|–—-]\s*/)[0], confidence: 0.6 },
    { value: new URL(url).hostname.replace(/^www\./, "").split(".")[0].replace(/[-_]/g, " "), confidence: 0.45 },
  ];
  for (const candidate of candidates) {
    const name = candidate.value ? normalizeCompanyName(candidate.value) : "";
    if (name.length >= 2 && name.length <= 80 && !/^(home|welcome|untitled|index)$/i.test(name)) {
      return { name: name.replace(/\b\w/g, (char) => char.toUpperCase()), confidence: candidate.confidence };
    }
  }
  return { name: new URL(url).hostname.replace(/^www\./, ""), confidence: 0.3 };
}
