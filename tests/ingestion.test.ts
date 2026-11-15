import { describe, expect, it } from "vitest";
import { classifySignal } from "@/lib/connectors/classify";
import { companyKey, domainFromUrl, extractCompanyFromHeadline, normalizeCompanyName } from "@/lib/connectors/extraction";
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
