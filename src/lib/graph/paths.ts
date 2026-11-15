export type GraphContact = {
  id: string;
  name: string;
  companyId: string | null;
  companyName: string | null;
  jobTitle: string | null;
  verified: boolean;
  strength: number;
  firstDegree?: boolean;
  relationshipType?: string;
};

export type GraphRelationship = {
  id: string;
  fromContactId: string;
  toContactId: string;
  relationshipType: string;
  strength: number;
  verified: boolean;
};

export type GraphCompany = {
  id: string;
  name: string;
};

export type GraphData = {
  contacts: GraphContact[];
  relationships: GraphRelationship[];
  companies: GraphCompany[];
};

export type PathNode =
  | { id: "you"; type: "you"; label: "You" }
  | { id: string; type: "contact"; label: string; contact: GraphContact }
  | { id: string; type: "company"; label: string; company: GraphCompany };

export type PathEdge = {
  from: string;
  to: string;
  type: "you_know" | "knows" | "works_at";
  label: string;
  verified: boolean;
  strength: number;
};

export type IntroPath = {
  companyId: string;
  companyName: string;
  nodes: PathNode[];
  edges: PathEdge[];
  hops: number;
  introductions: number;
  minStrength: number;
  verifiedEdges: number;
  explanation: string;
};

type Adjacent = { nodeId: string; edge: PathEdge };

function contactNode(contact: GraphContact): PathNode {
  return { id: contact.id, type: "contact", label: contact.name, contact };
}

export function findIntroPaths(
  graph: GraphData,
  companyId: string,
  options: { verifiedOnly?: boolean; limit?: number } = {},
): IntroPath[] {
  const { verifiedOnly = false, limit = 3 } = options;
  const company = graph.companies.find((item) => item.id === companyId);
  if (!company) return [];

  const contactsById = new Map(graph.contacts.map((contact) => [contact.id, contact]));
  const adjacency = new Map<string, Adjacent[]>();
  const add = (from: string, to: string, edge: PathEdge) => {
    if (!adjacency.has(from)) adjacency.set(from, []);
    adjacency.get(from)!.push({ nodeId: to, edge });
  };

  for (const contact of graph.contacts) {
    if (contact.firstDegree !== false) {
      add("you", contact.id, {
        from: "you",
        to: contact.id,
        type: "you_know",
        label: "knows",
        verified: true,
        strength: contact.strength,
      });
    }
    if (contact.companyId) {
      if (verifiedOnly && !contact.verified) continue;
      add(contact.id, contact.companyId, {
        from: contact.id,
        to: contact.companyId,
        type: "works_at",
        label: contact.jobTitle ? `works at ${company.name} · ${contact.jobTitle}` : `works at ${company.name}`,
        verified: contact.verified,
        strength: contact.strength,
      });
    }
  }

  for (const relationship of graph.relationships) {
    if (!contactsById.has(relationship.fromContactId) || !contactsById.has(relationship.toContactId)) continue;
    if (verifiedOnly && !relationship.verified) continue;
    const edge: PathEdge = {
      from: relationship.fromContactId,
      to: relationship.toContactId,
      type: "knows",
      label: relationship.relationshipType,
      verified: relationship.verified,
      strength: relationship.strength,
    };
    add(relationship.fromContactId, relationship.toContactId, edge);
    add(relationship.toContactId, relationship.fromContactId, { ...edge, from: relationship.toContactId, to: relationship.fromContactId });
  }

  // Sort neighbours so BFS prefers stronger, verified relationships at the same depth.
  for (const list of adjacency.values()) {
    list.sort((a, b) => Number(b.edge.verified) - Number(a.edge.verified) || b.edge.strength - a.edge.strength);
  }

  const targetId = companyId;
  const paths: IntroPath[] = [];
  const seenFirstHops = new Set<string>();

  // BFS from "you". We keep looking after the first match to collect alternate
  // shortest paths that start with a different first-degree contact.
  while (paths.length < limit) {
    const queue: string[] = ["you"];
    const visited = new Set<string>(["you"]);
    const previous = new Map<string, { node: string; edge: PathEdge }>();
    let found = false;

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === targetId) {
        found = true;
        break;
      }
      for (const next of adjacency.get(current) ?? []) {
        if (visited.has(next.nodeId)) continue;
        if (next.nodeId === "you") continue;
        // Alternate routes must start with a different first-degree contact, so
        // once a first hop is used we skip that whole branch on later passes.
        if (current === "you" && seenFirstHops.has(next.nodeId)) continue;
        visited.add(next.nodeId);
        previous.set(next.nodeId, { node: current, edge: next.edge });
        queue.push(next.nodeId);
      }
    }

    if (!found) break;
    const nodes: PathNode[] = [];
    const edges: PathEdge[] = [];
    let cursor = targetId;
    while (cursor !== "you") {
      const step = previous.get(cursor);
      if (!step) break;
      const contact = contactsById.get(cursor);
      if (cursor === targetId) {
        nodes.unshift({ id: company.id, type: "company", label: company.name, company });
      } else if (contact) {
        nodes.unshift(contactNode(contact));
      }
      edges.unshift(step.edge);
      cursor = step.node;
    }
    nodes.unshift({ id: "you", type: "you", label: "You" });

    const contactNodes = nodes.filter((node) => node.type === "contact") as Extract<PathNode, { type: "contact" }>[];
    if (contactNodes.length === 0) break;
    const firstContact = contactNodes[0].id;
    seenFirstHops.add(firstContact);
    const introEdges = edges.filter((edge) => edge.type === "knows");
    const minStrength = edges.reduce((min, edge) => Math.min(min, edge.strength), 5);
    const verifiedEdges = edges.filter((edge) => edge.verified).length;

    paths.push({
      companyId,
      companyName: company.name,
      nodes,
      edges,
      hops: edges.length,
      introductions: introEdges.length,
      minStrength,
      verifiedEdges,
      explanation:
        introEdges.length === 0
          ? `${contactNodes[0].label} already works at ${company.name}, so this is a direct route with no introduction needed.`
          : `${contactNodes[0].label} can introduce you through ${introEdges.length} connection${introEdges.length === 1 ? "" : "s"} to reach ${contactNodes[contactNodes.length - 1].label} at ${company.name}.`,
    });
  }

  return paths;
}

export function findBestIntroPath(graph: GraphData, companyId: string, verifiedOnly = false): IntroPath | null {
  return findIntroPaths(graph, companyId, { verifiedOnly, limit: 1 })[0] ?? null;
}

export function suggestIntroductionRequest(path: IntroPath, senderName = "me"): string {
  const contacts = path.nodes.filter((node) => node.type === "contact") as Extract<PathNode, { type: "contact" }>[];
  const company = path.nodes.find((node) => node.type === "company") as Extract<PathNode, { type: "company" }> | undefined;
  if (!company || contacts.length === 0) return "";
  const connector = contacts[0];
  const target = contacts[contacts.length - 1];
  const targetTitle = target.contact.jobTitle ? `, ${target.contact.jobTitle}` : "";

  if (contacts.length === 1) {
    return `Hi ${connector.label.split(" ")[0]},\n\nI saw you're at ${company.label}${targetTitle}. I'm working on something that may be relevant to your team and would love to compare notes. Would you be open to a short conversation?\n\n— ${senderName}`;
  }

  return `Hi ${connector.label.split(" ")[0]},\n\nI'm hoping you can help with a warm introduction. I'd like to speak with ${target.label}${targetTitle} at ${company.label} about a problem we may be able to help with.\n\nWould you be comfortable introducing us? Happy to send a short blurb you can forward first.\n\nThanks,\n${senderName}`;
}

export function buildGraphStats(graph: GraphData) {
  const companiesWithContacts = new Set(
    graph.contacts.map((contact) => contact.companyId).filter((id): id is string => Boolean(id)),
  );
  const verifiedRelationships = graph.relationships.filter((relationship) => relationship.verified).length;
  return {
    contacts: graph.contacts.length,
    relationships: graph.relationships.length,
    companies: companiesWithContacts.size,
    verifiedRelationships,
  };
}
