import {
  coerceAttrValue,
  elementsByLocalName,
  ensureNodesForEdges,
  firstElementByLocalName,
  parseXmlDocument,
  type GraphEdgeRecord,
  type ParsedGraphRecords,
} from "./parseGraphRecords";

type GexfAttrDef = {
  id: string;
  title: string;
  type?: string;
};

function readClassAttributeDefs(graphEl: Element): {
  nodeDefs: Map<string, GexfAttrDef>;
  edgeDefs: Map<string, GexfAttrDef>;
} {
  const nodeDefs = new Map<string, GexfAttrDef>();
  const edgeDefs = new Map<string, GexfAttrDef>();

  for (const attrsEl of elementsByLocalName(graphEl, "attributes")) {
    const cls = (attrsEl.getAttribute("class") || "").toLowerCase();
    for (const attrEl of elementsByLocalName(attrsEl, "attribute")) {
      const id = attrEl.getAttribute("id");
      if (!id) continue;
      const def: GexfAttrDef = {
        id,
        title: attrEl.getAttribute("title") || id,
        type: attrEl.getAttribute("type") || undefined,
      };
      if (cls === "edge") {
        edgeDefs.set(id, def);
      } else if (cls === "node") {
        nodeDefs.set(id, def);
      } else {
        nodeDefs.set(id, def);
        edgeDefs.set(id, def);
      }
    }
  }

  return { nodeDefs, edgeDefs };
}

function readAttvalues(
  el: Element,
  defs: Map<string, GexfAttrDef>
): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const attvaluesEl of elementsByLocalName(el, "attvalues")) {
    for (const av of elementsByLocalName(attvaluesEl, "attvalue")) {
      const forId = av.getAttribute("for") ?? av.getAttribute("id");
      if (!forId) continue;
      const def = defs.get(forId);
      const name = def?.title || forId;
      if (name === "id" || name === "from" || name === "to") continue;
      const raw = av.getAttribute("value") ?? av.textContent ?? "";
      props[name] = coerceAttrValue(raw, def?.type);
    }
  }
  return props;
}

function readVizPosition(el: Element): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const pos of elementsByLocalName(el, "position")) {
    const x = pos.getAttribute("x");
    const y = pos.getAttribute("y");
    const z = pos.getAttribute("z");
    if (x !== null && x !== "") props.x = coerceAttrValue(x, "float");
    if (y !== null && y !== "") props.y = coerceAttrValue(y, "float");
    if (z !== null && z !== "") props.z = coerceAttrValue(z, "float");
  }
  return props;
}

function collectNodes(
  graphEl: Element,
  nodeDefs: Map<string, GexfAttrDef>
): Record<string, unknown>[] {
  const nodesParent = firstElementByLocalName(graphEl, "nodes");
  const nodeElements = nodesParent
    ? Array.from(nodesParent.children).filter((c) => c.localName === "node")
    : elementsByLocalName(graphEl, "node");

  const nodes: Record<string, unknown>[] = [];
  for (const nodeEl of nodeElements) {
    const id = nodeEl.getAttribute("id");
    if (!id) {
      throw new Error("Invalid GEXF: <node> missing id attribute");
    }
    const label = nodeEl.getAttribute("label");
    const props: Record<string, unknown> = {
      ...readAttvalues(nodeEl, nodeDefs),
      ...readVizPosition(nodeEl),
    };
    if (label !== null && label !== "" && props.label === undefined) {
      props.label = label;
    }
    nodes.push({ id, ...props });
  }
  return nodes;
}

function collectEdges(
  graphEl: Element,
  edgeDefs: Map<string, GexfAttrDef>
): GraphEdgeRecord[] {
  const edgesParent = firstElementByLocalName(graphEl, "edges");
  const edgeElements = edgesParent
    ? Array.from(edgesParent.children).filter((c) => c.localName === "edge")
    : elementsByLocalName(graphEl, "edge");

  const edges: GraphEdgeRecord[] = [];
  for (const edgeEl of edgeElements) {
    const source = edgeEl.getAttribute("source");
    const target = edgeEl.getAttribute("target");
    if (!source || !target) {
      throw new Error(
        "Invalid GEXF: <edge> must have source and target attributes"
      );
    }
    const props: Record<string, unknown> = {
      ...readAttvalues(edgeEl, edgeDefs),
    };
    const weight = edgeEl.getAttribute("weight");
    if (weight !== null && weight !== "" && props.weight === undefined) {
      props.weight = coerceAttrValue(weight, "float");
    }
    const label = edgeEl.getAttribute("label");
    if (label !== null && label !== "" && props.label === undefined) {
      props.label = label;
    }
    edges.push({ from: source, to: target, ...props });
  }
  return edges;
}

/**
 * Parse GEXF XML into node/edge records for native import.
 * Edge endpoints use `from` / `to` (JSON import convention).
 * Viz position is mapped to node properties x/y/(z) when present.
 */
export function parseGEXF(xmlText: string): ParsedGraphRecords {
  const doc = parseXmlDocument(xmlText, "GEXF");
  const graphEl = firstElementByLocalName(doc, "graph");
  if (!graphEl) {
    throw new Error("Invalid GEXF: missing <graph> element");
  }

  const defaultEdgeType = (
    graphEl.getAttribute("defaultedgetype") || "directed"
  ).toLowerCase();
  const suggestedDirected = defaultEdgeType !== "undirected";

  const { nodeDefs, edgeDefs } = readClassAttributeDefs(graphEl);
  const nodes = collectNodes(graphEl, nodeDefs);
  const edges = collectEdges(graphEl, edgeDefs);

  if (edges.length === 0) {
    throw new Error("GEXF must contain at least one edge");
  }

  return {
    nodes: ensureNodesForEdges(nodes, edges),
    edges,
    suggestedDirected,
  };
}
