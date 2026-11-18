import { describe, expect, it } from "vitest";
import { interpretProductDescription } from "@/lib/icp/interpreter";

describe("ICP interpretation for the one-click scan", () => {
  it("recognises a clinic as Healthtech so the scan can run without a follow-up", () => {
    const interpretation = interpretProductDescription(
      "We sell a scheduling and reminder tool for independent dental clinics in India. " +
        "It reduces no-shows and lets front-desk staff confirm appointments by WhatsApp.",
    );

    expect(interpretation.targetIndustries).toContain("Healthtech");
    expect(interpretation.geographies).toContain("India");
    expect(interpretation.warnings).not.toContain("Add at least one target industry before running discovery.");
  });

  it("reports an empty industry list when the description has no recognisable market", () => {
    const interpretation = interpretProductDescription(
      "We sell a faster way to onboard new hires across distributed teams in India.",
    );

    // QuickScan detects this case and asks for one industry instead of posting
    // a payload that fails the API's min(1) validation.
    expect(interpretation.targetIndustries).toEqual([]);
    expect(interpretation.warnings).toContain("Add at least one target industry before running discovery.");
  });
});
