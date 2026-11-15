import { describe, expect, it } from "vitest";
import { findIntroPaths, findBestIntroPath, suggestIntroductionRequest, type GraphData } from "@/lib/graph/paths";

function graph(): GraphData {
  return {
    companies: [
      { id: "c-target", name: "Kestrel Finance" },
      { id: "c-other", name: "Northwind Labs" },
    ],
    contacts: [
      { id: "alex", name: "Alex Morgan", companyId: null, companyName: null, jobTitle: "VP Sales", verified: true, strength: 5, firstDegree: true },
      // Priya is an introduction target, not someone you know directly.
      { id: "priya", name: "Priya Shah", companyId: "c-target", companyName: "Kestrel Finance", jobTitle: "Head of RevOps", verified: true, strength: 3, firstDegree: false },
      // Daniel is an unverified card at the target, reachable only through Priya.
      { id: "daniel", name: "Daniel Okafor", companyId: "c-target", companyName: "Kestrel Finance", jobTitle: "VP Engineering", verified: false, strength: 2, firstDegree: false },
      { id: "sofia", name: "Sofia Berg", companyId: "c-other", companyName: "Northwind Labs", jobTitle: "COO", verified: true, strength: 4, firstDegree: true },
    ],
    relationships: [
      { id: "r1", fromContactId: "alex", toContactId: "priya", relationshipType: "Former colleague", strength: 5, verified: true },
      { id: "r2", fromContactId: "priya", toContactId: "daniel", relationshipType: "Colleague", strength: 2, verified: false },
      { id: "r3", fromContactId: "alex", toContactId: "sofia", relationshipType: "Friend", strength: 4, verified: false },
      { id: "r4", fromContactId: "sofia", toContactId: "priya", relationshipType: "Conference contact", strength: 3, verified: true },
    ],
  };
}

describe("findIntroPaths", () => {
  it("returns the shortest route to a target company", () => {
    const paths = findIntroPaths(graph(), "c-target", { limit: 1 });
    expect(paths).toHaveLength(1);
    expect(paths[0].nodes.map((node) => node.label)).toEqual(["You", "Alex Morgan", "Priya Shah", "Kestrel Finance"]);
    expect(paths[0].hops).toBe(3);
    expect(paths[0].introductions).toBe(1);
  });

  it("offers alternate shortest paths that begin with a different first hop", () => {
    const paths = findIntroPaths(graph(), "c-target", { limit: 3 });
    // Priya is an introduction target, so every route needs a connector: Alex
    // and Sofia are the two distinct people you know directly.
    expect(paths).toHaveLength(2);
    expect(paths.map((path) => path.nodes[1].label)).toEqual(["Alex Morgan", "Sofia Berg"]);
    expect(paths.every((path) => path.nodes.some((node) => node.id === "priya"))).toBe(true);
    expect(paths.every((path) => path.introductions === 1)).toBe(true);
  });

  it("filters out unverified relationships and contacts when verifiedOnly is set", () => {
    const withVerified = findIntroPaths(graph(), "c-target", { verifiedOnly: true, limit: 3 });
    expect(withVerified.length).toBeGreaterThan(0);
    expect(withVerified.every((path) => path.edges.every((edge) => edge.verified))).toBe(true);
    expect(withVerified.some((path) => path.nodes.some((node) => node.id === "daniel"))).toBe(false);
  });

  it("returns no path when nobody in the graph works at the target", () => {
    const g = graph();
    g.companies.push({ id: "c-unreachable", name: "Unreachable Co" });
    expect(findIntroPaths(g, "c-unreachable", { limit: 3 })).toEqual([]);
    expect(findIntroPaths({ ...graph(), companies: [{ id: "c-empty", name: "Empty Co" }] }, "c-empty")).toEqual([]);
  });

  it("prefers a direct route when you already know someone at the company", () => {
    const paths = findIntroPaths(graph(), "c-other", { limit: 3 });
    expect(paths[0].hops).toBe(2);
    expect(paths[0].introductions).toBe(0);
    expect(paths[0].nodes[1].label).toBe("Sofia Berg");
  });

  it("returns no path for an unknown company", () => {
    expect(findIntroPaths(graph(), "missing")).toEqual([]);
  });

  it("finds a direct route when a first-degree contact already works there", () => {
    const g = graph();
    g.contacts.push({ id: "marcus", name: "Marcus Reed", companyId: "c-target", companyName: "Kestrel Finance", jobTitle: "Director", verified: true, strength: 4 });
    const best = findBestIntroPath(g, "c-target");
    expect(best).not.toBeNull();
    expect(best!.hops).toBe(2);
    expect(best!.introductions).toBe(0);
    expect(best!.explanation).toContain("already works at");
  });

  it("generates an introduction request without inventing a relationship", () => {
    const path = findBestIntroPath(graph(), "c-target")!;
    const request = suggestIntroductionRequest(path, "Kanishk");
    expect(request).toContain("Alex");
    expect(request).toContain("Priya Shah");
    expect(request).toContain("Kestrel Finance");
    expect(request).toContain("Kanishk");
    expect(request.toLowerCase()).toContain("warm introduction");
  });
});
