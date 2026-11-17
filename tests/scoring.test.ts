import { describe, expect, it } from "vitest";
import type { SignalType } from "@prisma/client";
import { scoreProspect, type ScoringCompany, type ScoringIcp, type ScoringSignal } from "@/lib/scoring/score";
import { DEFAULT_SCORING_CONFIG } from "@/lib/scoring/config";

const now = new Date("2026-11-15T12:00:00Z");

const icp: ScoringIcp = {
  targetIndustries: ["Fintech", "B2B SaaS"],
  geographies: ["United Kingdom", "United States"],
  companySizeMin: 20,
  companySizeMax: 500,
  buyerRoles: ["VP Sales / Sales leadership", "Revenue Operations"],
  painPoints: ["Pipeline forecasting"],
  buyingTriggers: ["Funding", "Hiring", "Product launches"],
  exclusions: [],
  selectedSignalTypes: ["HIRING", "FUNDING", "PRODUCT_LAUNCH"],
};

const company: ScoringCompany = {
  name: "Kestrel Finance",
  industry: "Fintech",
  location: "London, United Kingdom",
  employeeCount: 240,
  employeeRange: "201–500",
  description: "Treasury tooling for finance teams.",
};

function signal(overrides: Partial<ScoringSignal> & { id: string; type: SignalType }): ScoringSignal {
  return {
    title: "Kestrel Finance raises $24M Series B",
    summary: "The fintech will expand its revenue operations team.",
    evidence: "Kestrel Finance raised $24M to scale its go-to-market team.",
    confidence: 0.9,
    publishedAt: new Date("2026-11-12T00:00:00Z"),
    discoveredAt: new Date("2026-11-13T00:00:00Z"),
    sourceUrl: "https://example.com/news/kestrel",
    sourceName: "Example News",
    ...overrides,
  };
}

describe("scoreProspect", () => {
  it("scores a strong ICP fit and strong recent signal highly, with priority blended from both", () => {
    const result = scoreProspect(icp, company, [signal({ id: "s1", type: "FUNDING" })], DEFAULT_SCORING_CONFIG, now);
    expect(result.icpScore).toBeGreaterThanOrEqual(80);
    expect(result.signalScore).toBeGreaterThanOrEqual(50);
    const fitMultiplier = 0.35 + 0.65 * (result.icpScore / 100);
    expect(result.priorityScore).toBe(
      Math.round(
        (result.icpScore * DEFAULT_SCORING_CONFIG.priorityIcpWeight +
          result.signalScore * DEFAULT_SCORING_CONFIG.prioritySignalWeight * fitMultiplier) /
          (DEFAULT_SCORING_CONFIG.priorityIcpWeight + DEFAULT_SCORING_CONFIG.prioritySignalWeight),
      ),
    );
    expect(result.breakdown.icp.components.some((component) => component.key === "industry" && component.status === "matched")).toBe(true);
    expect(result.breakdown.priority.formula).toContain("×");
  });

  it("returns a zero signal score when there is no evidence, without lowering ICP fit", () => {
    const result = scoreProspect(icp, company, [], DEFAULT_SCORING_CONFIG, now);
    expect(result.signalScore).toBe(0);
    expect(result.icpScore).toBeGreaterThan(50);
    expect(result.priorityScore).toBeLessThan(result.icpScore + 1);
  });

  it("gives neutral partial credit for unverified headcount and labels it", () => {
    const unknownSize = scoreProspect(
      icp,
      { ...company, employeeCount: null, employeeRange: null },
      [signal({ id: "s1", type: "FUNDING" })],
      DEFAULT_SCORING_CONFIG,
      now,
    );
    const size = unknownSize.breakdown.icp.components.find((component) => component.key === "size");
    expect(size?.status).toBe("unknown");
    expect(size?.points).toBeGreaterThan(0);
    expect(size?.reason.toLowerCase()).toContain("not verified");
  });

  it("caps ICP fit when an exclusion matches", () => {
    const result = scoreProspect(
      { ...icp, exclusions: ["Enterprises over 500 employees"] },
      { ...company, employeeCount: 5000 },
      [signal({ id: "s1", type: "FUNDING" })],
      DEFAULT_SCORING_CONFIG,
      now,
    );
    expect(result.icpScore).toBeLessThanOrEqual(35);
    expect(result.breakdown.icp.excluded).toBe(true);
  });

  it("decays older signals and rewards category diversity", () => {
    const recent = scoreProspect(icp, company, [signal({ id: "new", type: "FUNDING" })], DEFAULT_SCORING_CONFIG, now);
    const old = scoreProspect(
      icp,
      company,
      [signal({ id: "old", type: "FUNDING", publishedAt: new Date("2026-02-01T00:00:00Z"), discoveredAt: new Date("2026-02-01T00:00:00Z") })],
      DEFAULT_SCORING_CONFIG,
      now,
    );
    expect(recent.signalScore).toBeGreaterThan(old.signalScore);

    const diverse = scoreProspect(
      icp,
      company,
      [signal({ id: "a", type: "FUNDING" }), signal({ id: "b", type: "HIRING", title: "Kestrel is hiring 12 account executives" })],
      DEFAULT_SCORING_CONFIG,
      now,
    );
    expect(diverse.breakdown.signal.distinctCategories).toBe(2);
    expect(diverse.signalScore).toBeGreaterThan(recent.signalScore);
  });

  it("marks a known industry that misses the ICP as a mismatch", () => {
    const result = scoreProspect(icp, { ...company, industry: "Logistics" }, [signal({ id: "s1", type: "FUNDING" })], DEFAULT_SCORING_CONFIG, now);
    const industry = result.breakdown.icp.components.find((component) => component.key === "industry");
    expect(industry?.status).toBe("mismatch");
    expect(industry?.points).toBe(0);
  });

  it("does not let a strong signal outrank a better-fitting company", () => {
    const strongSignal = [signal({ id: "s1", type: "FUNDING" }), signal({ id: "s2", type: "HIRING" }), signal({ id: "s3", type: "PRODUCT_LAUNCH" })];
    const poorFit = scoreProspect(
      icp,
      { ...company, industry: null, location: null, employeeCount: null, employeeRange: null },
      strongSignal,
      DEFAULT_SCORING_CONFIG,
      now,
    );
    const goodFit = scoreProspect(icp, company, [signal({ id: "s1", type: "FUNDING" })], DEFAULT_SCORING_CONFIG, now);
    expect(goodFit.priorityScore).toBeGreaterThan(poorFit.priorityScore);
    expect(poorFit.breakdown.priority.signalFitMultiplier).toBeLessThan(1);
  });

  it("respects custom priority weights", () => {
    const icpOnly = scoreProspect(icp, company, [signal({ id: "s1", type: "FUNDING" })], {
      ...DEFAULT_SCORING_CONFIG,
      priorityIcpWeight: 100,
      prioritySignalWeight: 0,
    }, now);
    expect(icpOnly.priorityScore).toBe(icpOnly.icpScore);
  });
});
