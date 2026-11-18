import { atsFromHtml, companyNameFromDomain, normalizeDomain } from "@/lib/connectors/ats-parse";
import { describe, expect, it } from "vitest";
import { buildDefaultSources } from "@/lib/connectors";
import { classifySignal } from "@/lib/connectors/classify";
import { directoryCompanyFor, directoryWatchlist } from "@/lib/connectors/company-directory";
import {
  companyKey,
  domainFromUrl,
  extractCompanyFromHeadline,
  inferCompanyLocation,
  inferIndustry,
  locationMatchesGeographies,
  normalizeCompanyName,
} from "@/lib/connectors/extraction";
import { parseJobicyJobs } from "@/lib/connectors/job-feed";
import { parseRssItems } from "@/lib/connectors/rss";
import { parseContactsCsv, toCsv, contactsCsvTemplate } from "@/lib/contacts/csv";

describe("signal classification", () => {
  it("classifies a funding headline with evidence", () => {
    const candidates = classifySignal({
      title: "Kestrel Finance raises $24M Series B to expand treasury tooling",
      summary: "The London fintech will double its go-to-market team.",
      sourceType: "RSS",
      companyConfidence: 0.9,
    });
    expect(candidates[0]?.type).toBe("FUNDING");
    expect(candidates[0]?.confidence).toBeGreaterThan(0.7);
    expect(candidates[0]?.evidence).toContain("Kestrel Finance");
  });

  it("classifies hiring posts from a public job feed", () => {
    const candidates = classifySignal({
      title: "Northwind Labs is hiring a VP Sales",
      summary: "Open role: lead the revenue organisation.",
      sourceType: "JOB_FEED",
      signalHints: ["HIRING"],
      companyConfidence: 0.8,
    });
    expect(candidates.some((candidate) => candidate.type === "HIRING")).toBe(true);
  });

  it("never returns more than two weak signals from one document", () => {
    const candidates = classifySignal({
      title: "Company launches new product, opens Berlin office, raises $10M and hires a CRO",
      summary: "A very busy press release with several claims.",
      sourceType: "WEBSITE",
      companyConfidence: 0.9,
    });
    expect(candidates.length).toBeLessThanOrEqual(2);
    expect(candidates.every((candidate) => candidate.confidence >= 0.5)).toBe(true);
  });

  it("returns nothing for an unrelated headline", () => {
    const candidates = classifySignal({
      title: "A quiet week in the park",
      summary: "Nothing commercial happened.",
      sourceType: "RSS",
    });
    expect(candidates).toEqual([]);
  });
});

describe("company extraction", () => {
  it("normalises company names for display and builds a dedupe key", () => {
    // Display names keep their casing and legal suffix...
    expect(normalizeCompanyName("  Northwind Labs, Inc.  ")).toBe("Northwind Labs, Inc");
    // ...while the dedupe key ignores case, punctuation and the suffix.
    expect(companyKey("Northwind Labs")).toBe(companyKey("northwind labs, inc"));
    expect(companyKey("Northwind Labs, Inc.")).toBe("northwindlabs");
    expect(domainFromUrl("https://www.NorthwindLabs.example/about")).toBe("northwindlabs.example");
  });

  it("extracts the company from a funding headline", () => {
    const extracted = extractCompanyFromHeadline("Kestrel Finance raises $24M Series B");
    expect(extracted?.name.toLowerCase()).toContain("kestrel");
  });
});

describe("contact CSV", () => {
  it("parses the sample template and normalises strength/verification", () => {
    const parsed = parseContactsCsv(contactsCsvTemplate());
    expect(parsed.rows.length).toBe(2);
    expect(parsed.rows[0].name).toBe("Alex Morgan");
    expect(parsed.rows[0].strength).toBe(4);
    expect(parsed.rows[0].verified).toBe(true);
    expect(parsed.rows[1].knows).toBe("Alex Morgan");
  });

  it("reports invalid rows without failing the whole import", () => {
    const parsed = parseContactsCsv("name,email\n,not-an-email\nPriya Shah,priya@example.com");
    expect(parsed.rows.length).toBe(1);
    expect(parsed.errors.length).toBeGreaterThan(0);
  });

  it("imports a LinkedIn connections export, including its notes preamble", () => {
    const csv = [
      "Notes:",
      '"When exporting your connection data, you may notice that some of the fields are empty."',
      "",
      "First Name,Last Name,URL,Email Address,Company,Position,Connected On",
      "Alex,Morgan,https://www.linkedin.com/in/example-alex,,Northwind Labs,VP Sales,12 Mar 2024",
      "Priya,Shah,https://www.linkedin.com/in/example-priya,,Kestrel Finance,Head of RevOps,04 Nov 2025",
    ].join("\n");
    const parsed = parseContactsCsv(csv);
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].name).toBe("Alex Morgan");
    expect(parsed.rows[0].relationshipType).toBe("LinkedIn connection");
    expect(parsed.rows[0].firstDegree).toBe(true);
    expect(parsed.rows[0].notes).toContain("12 Mar 2024");
    expect(parsed.rows[0].linkedinUrl).toBe("https://www.linkedin.com/in/example-alex");
  });

  it("treats missing first_degree as a direct contact and parses explicit targets", () => {
    const csv = [
      "name,email,company,job_title,relationship_type,relationship_strength,verified,first_degree,notes,linkedin_url,knows",
      "Alex Morgan,alex@example.com,Northwind Labs,VP Sales,Former colleague,5,true,,Known directly,,",
      "Priya Shah,priya@example.com,Kestrel Finance,Head of RevOps,Investor intro,3,true,false,Introduction target,,",
    ].join("\n");
    const parsed = parseContactsCsv(csv);
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.rows[0].firstDegree).toBe(true);
    expect(parsed.rows[1].firstDegree).toBe(false);
  });

  it("escapes CSV formula injection on export", () => {
    const csv = toCsv(["name", "notes"], [["=SUM(A1:A2)", "@handle"]]);
    expect(csv).toContain("\"'=SUM(A1:A2)\"");
    expect(csv).toContain("\"'@handle\"");
  });
});

describe("ATS discovery helpers", () => {
  it("normalises domains and rejects junk input", () => {
    expect(normalizeDomain("https://www.Linear.app/careers")).toBe("linear.app");
    expect(normalizeDomain("vercel.com")).toBe("vercel.com");
    expect(normalizeDomain("not a domain")).toBeNull();
  });

  it("finds the ATS board behind a careers page", () => {
    expect(atsFromHtml('<a href="https://jobs.ashbyhq.com/linear">Open roles</a>')).toEqual({ provider: "ashby", token: "linear" });
    expect(atsFromHtml('<iframe src="https://boards.greenhouse.io/embed/job_board?for=vercel"></iframe>')).toEqual({
      provider: "greenhouse",
      token: "vercel",
    });
    expect(atsFromHtml('<a href="https://jobs.lever.co/acme">Jobs</a>')).toEqual({ provider: "lever", token: "acme" });
    expect(atsFromHtml("<p>Email us to apply</p>")).toBeNull();
  });

  it("derives a readable company name from a domain", () => {
    expect(companyNameFromDomain("linear.app")).toBe("Linear");
    expect(companyNameFromDomain("north-wind.dev")).toBe("North Wind");
  });
});

describe("job feed parsing", () => {
  it("keeps the newest listings when a board returns more than the limit", () => {
    const jobs = [
      { id: 1, jobTitle: "Old role", companyName: "Northwind", jobIndustry: ["Product & Operations"], pubDate: "2026-01-02T00:00:00Z" },
      { id: 2, jobTitle: "Fresh role", companyName: "Northwind", jobIndustry: ["Product & Operations"], pubDate: "2026-11-10T00:00:00Z" },
    ];
    const documents = parseJobicyJobs(jobs, 1);
    expect(documents).toHaveLength(1);
    expect(documents[0].title).toContain("Fresh role");
    expect(documents[0].publishedAt?.toISOString().slice(0, 10)).toBe("2026-11-10");
  });

  it("does not mistake a job function for a company industry", () => {
    const documents = parseJobicyJobs(
      [{ id: 3, jobTitle: "Account Executive", companyName: "Kestrel", jobIndustry: ["Marketing & Sales"], pubDate: "2026-11-10T00:00:00Z" }],
      1,
    );
    expect(documents[0].company.industry).toBeUndefined();
    expect(documents[0].tags).toEqual(["Marketing & Sales"]);
  });

  it("never stores a candidate's location as the employer's headquarters", () => {
    const documents = parseJobicyJobs(
      [{ id: 4, jobTitle: "Account Executive", companyName: "Kestrel", jobGeo: "Bengaluru, India", pubDate: "2026-11-10T00:00:00Z" }],
      1,
    );
    expect(documents[0].company.location).toBeUndefined();
    expect(documents[0].metadata?.jobLocation).toBe("Bengaluru, India");
  });

  it("infers a target industry from description wording", () => {
    expect(inferIndustry("Payments infrastructure for European banks and lenders", ["Fintech"])).toEqual({
      industry: "Fintech",
      confidence: 0.65,
    });
    expect(inferIndustry("A community newsletter about gardening", ["Fintech"]).industry).toBeNull();
  });
});

describe("geography extraction", () => {
  it("turns an Indian city into a country-level location", () => {
    expect(inferCompanyLocation("Bengaluru-based Kestrel raises $12M Series A")).toEqual({
      geography: "India",
      location: "Bengaluru, India",
    });
    expect(inferCompanyLocation("Indian fintech Kestrel raises $12M")).toEqual({
      geography: "India",
      location: "India",
    });
  });

  it("does not invent a location from text that names none", () => {
    expect(inferCompanyLocation("A quiet week in the park")).toBeNull();
  });

  it("matches known company locations against target geographies", () => {
    expect(locationMatchesGeographies("Bengaluru, India", ["India"])).toBe(true);
    expect(locationMatchesGeographies("Pune, India", ["India"])).toBe(true);
    expect(locationMatchesGeographies("San Francisco, United States", ["India"])).toBe(false);
    expect(locationMatchesGeographies("Europe", ["United Kingdom"])).toBe(true);
    expect(locationMatchesGeographies("Germany", ["Europe"])).toBe(true);
    expect(locationMatchesGeographies(null, ["India"])).toBe(false);
    expect(locationMatchesGeographies("Berlin, Germany", ["Remote / global"])).toBe(true);
  });

  it("uses a single-market publication as a location fallback", () => {
    const parsed = parseRssItems(
      [{ title: "Kestrel raises $10M Series A", link: "https://example.com/kestrel", contentSnippet: "The startup will hire across product and sales." }],
      { feedUrl: "https://example.com/feed", region: "India", maxItems: 5 },
      { title: "Inc42" },
    );
    expect(parsed.documents[0]?.company.location).toBe("India");
  });
});

describe("company directory", () => {
  it("resolves a company by domain or name and returns verified facts", () => {
    expect(directoryCompanyFor({ domain: "https://www.cred.club/careers" })?.industry).toBe("Fintech");
    expect(directoryCompanyFor({ name: "Razorpay" })?.location).toBe("Bengaluru, India");
    expect(directoryCompanyFor({ name: "Totally Unknown Co" })).toBeNull();
  });

  it("builds an India watchlist only for matching industries", () => {
    const fintech = directoryWatchlist({ targetIndustries: ["Fintech"], geographies: ["India"] });
    expect(fintech.map((entry) => entry.domain)).toEqual(expect.arrayContaining(["razorpay.com", "cred.club", "groww.in"]));
    expect(fintech.every((entry) => entry.provider && entry.boardToken)).toBe(true);
    expect(directoryWatchlist({ targetIndustries: ["Fintech"], geographies: ["United States"] })).toEqual([]);
  });

  it("switches default sources to India instead of US feeds", () => {
    const sources = buildDefaultSources({
      productCategory: "KYC and onboarding platform",
      targetIndustries: ["Fintech"],
      buyerRoles: ["Founder / CEO"],
      geographies: ["India"],
      selectedSignalTypes: ["FUNDING", "HIRING"],
    });
    const names = sources.map((source) => source.name);
    expect(names).toContain("Inc42 · Indian startups");
    expect(names).toContain("YourStory · Indian founders");
    expect(names).toContain("Google News · India industry news");
    expect(names).toContain("Hiring watchlist · India companies");
    expect(names.some((name) => name.startsWith("TechCrunch · Startup"))).toBe(false);
    expect(names.some((name) => name.startsWith("Remotive"))).toBe(false);
  });
});

describe("headline company extraction", () => {
  it("strips news prefixes and descriptor words from funding headlines", () => {
    expect(extractCompanyFromHeadline("AI inference startup Daisytuner raises €6M seed")?.name).toBe("Daisytuner");
    expect(extractCompanyFromHeadline("Finnish healthtech Treat raises €3M to fix private healthcare")?.name).toBe("Treat");
    expect(extractCompanyFromHeadline("Exclusive: Kestrel raises $12M Series A")?.name).toBe("Kestrel");
    expect(extractCompanyFromHeadline("India’s EloElo raises $8M to expand its creator platform")?.name).toBe("EloElo");
  });

  it("rejects people, investors and unnamed alumni as companies", () => {
    expect(extractCompanyFromHeadline("Exclusive: Nubank alum raises €3M for a new payments app")).toBeNull();
    expect(extractCompanyFromHeadline("Collide Capital raises $95M fund to back fintech startups")).toBeNull();
    expect(extractCompanyFromHeadline("Indian semiconductor startup raises $24 million in seed funding")).toBeNull();
  });
});
