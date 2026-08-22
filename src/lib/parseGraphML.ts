import {
  coerceAttrValue,
  elementsByLocalName,
  ensureNodesForEdges,
  firstElementByLocalName,
  parseXmlDocument,
  type GraphEdgeRecord,
  type ParsedGraphRecords,
} from "./parseGraphRecords";

type GraphMLKey = {
  id: string;
  name: string;
  for: string;
  type?: string;
};

function readKeys(doc: Document): Map<string, GraphMLKey> {
  const keys = new Map<string, GraphMLKey>();
  for (const keyEl of elementsByLocalName(doc, "key")) {
    const id = keyEl.getAttribute("id");
    if (!id) continue;
    const name =
      keyEl.getAttribute("attr.name") || keyEl.getAttribute("attrName") || id;
    keys.set(id, {
      id,
      name,
      for: (keyEl.getAttribute("for") || "all").toLowerCase(),
      type:
        keyEl.getAttribute("attr.type") ||
        keyEl.getAttribute("attrType") ||
        undefined,
    });
  }
  return keys;
}

function readDataProps(
  el: Element,
  keys: Map<string, GraphMLKey>,
  scope: "node" | "edge"
): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const dataEl of elementsByLocalName(el, "data")) {
    const keyId = dataEl.getAttribute("key");
    if (!keyId) continue;
    const keyDef = keys.get(keyId);
    const forTarget = keyDef?.for || "all";
    if (forTarget !== "all" && forTarget !== scope && forTarget !== "graph") {
      continue;
    }
    const propName = keyDef?.name || keyId;
    if (propName === "id" || propName === "from" || propName === "to") {
      continue;
    }
    props[propName] = coerceAttrValue(dataEl.textContent ?? "", keyDef?.type);
  }
  return props;
}

/**
 * Parse GraphML XML into node/edge records for native import.
 * Edge endpoints use `from` / `to` (JSON import convention).
 */
export function parseGraphML(xmlText: string): ParsedGraphRecords {
  const doc = parseXmlDocument(xmlText, "GraphML");
  const graphEl = firstElementByLocalName(doc, "graph");
  if (!graphEl) {
    throw new Error("Invalid GraphML: missing <graph> element");
  }

  const edgedefault = (
    graphEl.getAttribute("edgedefault") || "directed"
  ).toLowerCase();
  const suggestedDirected = edgedefault !== "undirected";

  const keys = readKeys(doc);
  const nodes: Record<string, unknown>[] = [];

  for (const nodeEl of elementsByLocalName(graphEl, "node")) {
    const id = nodeEl.getAttribute("id");
    if (!id) {
      throw new Error("Invalid GraphML: <node> missing id attribute");
    }
    const props = readDataProps(nodeEl, keys, "node");
    nodes.push({ id, ...props });
  }

  const edges: GraphEdgeRecord[] = [];
  for (const edgeEl of elementsByLocalName(graphEl, "edge")) {
    const source = edgeEl.getAttribute("source");
    const target = edgeEl.getAttribute("target");
    if (!source || !target) {
      throw new Error(
        "Invalid GraphML: <edge> must have source and target attributes"
      );
    }
    const props = readDataProps(edgeEl, keys, "edge");
    const edgeId = edgeEl.getAttribute("id");
    if (edgeId !== null && edgeId !== "") {
      props.id = edgeId;
    }
    const directedAttr = edgeEl.getAttribute("directed");
    if (directedAttr !== null) {
      props.directed = directedAttr.toLowerCase() === "true";
    }
    edges.push({ from: source, to: target, ...props });
  }

  if (edges.length === 0) {
    throw new Error("GraphML must contain at least one edge");
  }

  return {
    nodes: ensureNodesForEdges(nodes, edges),
    edges,
    suggestedDirected,
  };
}
