import { resolveEndpointColumns } from "./resolveEdgeEndpoints";

/**
 * Build a minimal nodes CSV from unique edge endpoints.
 * Primary key column is named `id`.
 * Accepts common endpoint header aliases (source/target, id1/id2, 1/2, …).
 */
export function synthesizeNodesFromEdges(edgesText: string): string {
  const lines = edgesText.trim().split("\n");
  if (lines.length < 2) {
    throw new Error(
      "Cannot infer nodes: edges.csv must have a header and at least one edge row"
    );
  }

  const edgeColumns = lines[0].split(",").map((col) => col.trim());
  const { sourceIdx, targetIdx } = resolveEndpointColumns(edgeColumns);

  const nodeIds = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((col) => col.trim());
    const source = values[sourceIdx];
    const target = values[targetIdx];
    if (source) nodeIds.add(source);
    if (target) nodeIds.add(target);
  }

  if (nodeIds.size === 0) {
    throw new Error(
      "Cannot infer nodes: no non-empty endpoint values found in edges.csv"
    );
  }

  return ["id", ...nodeIds].join("\n");
}
