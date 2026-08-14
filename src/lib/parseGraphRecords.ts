export type GraphEdgeRecord = {
  from: string;
  to: string;
} & Record<string, unknown>;

export type ParsedGraphRecords = {
  nodes: Record<string, unknown>[];
  edges: GraphEdgeRecord[];
  suggestedDirected: boolean;
};

/** Elements with the given local name under parent (any XML namespace). */
export function elementsByLocalName(
  parent: Document | Element,
  localName: string
): Element[] {
  return Array.from(parent.getElementsByTagNameNS("*", localName));
}

export function firstElementByLocalName(
  parent: Document | Element,
  localName: string
): Element | undefined {
  return elementsByLocalName(parent, localName)[0];
}

export function parseXmlDocument(
  xmlText: string,
  formatLabel: string
): Document {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error(
      `Invalid ${formatLabel}: ${parseError.textContent?.trim() || "XML parse error"}`
    );
  }
  return doc;
}

/**
 * Ensure every edge endpoint exists as a node. Existing nodes keep their properties.
 * Node `id` is always the first property key.
 */
export function ensureNodesForEdges(
  nodes: Record<string, unknown>[],
  edges: GraphEdgeRecord[]
): Record<string, unknown>[] {
  const byId = new Map<string, Record<string, unknown>>();

  for (const node of nodes) {
    const id = node.id;
    if (id === undefined || id === null || String(id).length === 0) {
      throw new Error("Every node must have a non-empty id");
    }
    const idStr = String(id);
    const rest = { ...node };
    delete rest.id;
    byId.set(idStr, { id: idStr, ...rest });
  }

  for (const edge of edges) {
    for (const endpoint of [edge.from, edge.to]) {
      if (!byId.has(endpoint)) {
        byId.set(endpoint, { id: endpoint });
      }
    }
  }

  return Array.from(byId.values());
}

export function coerceAttrValue(raw: string, typeHint?: string): unknown {
  const trimmed = raw.trim();
  const type = (typeHint || "").toLowerCase();

  if (type === "boolean" || type === "bool") {
    return trimmed.toLowerCase() === "true" || trimmed === "1";
  }
  if (
    type === "integer" ||
    type === "int" ||
    type === "long" ||
    type === "float" ||
    type === "double" ||
    type === "real"
  ) {
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : trimmed;
  }

  // Heuristic when no type hint
  if (trimmed === "true" || trimmed === "false") {
    return trimmed === "true";
  }
  if (
    trimmed !== "" &&
    !Number.isNaN(Number(trimmed)) &&
    /^-?\d+(\.\d+)?$/.test(trimmed)
  ) {
    return Number(trimmed);
  }
  return trimmed;
}
