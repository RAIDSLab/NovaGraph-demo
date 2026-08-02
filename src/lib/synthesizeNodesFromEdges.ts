/**
 * Build a minimal nodes CSV from unique edge endpoints.
 * Primary key column is named `id`.
 */
export function synthesizeNodesFromEdges(edgesText: string): string {
  const lines = edgesText.trim().split("\n");
  if (lines.length < 2) {
    throw new Error(
      "Cannot infer nodes: edges.csv must have a header and at least one edge row"
    );
  }

  const edgeColumns = lines[0].split(",").map((col) => col.trim());
  const sourceIdx = edgeColumns.indexOf("source");
  const targetIdx = edgeColumns.indexOf("target");

  if (sourceIdx === -1 || targetIdx === -1) {
    throw new Error(
      "Cannot infer nodes: edges.csv must have 'source' and 'target' columns"
    );
  }

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
      "Cannot infer nodes: no non-empty source/target values found in edges.csv"
    );
  }

  return ["id", ...nodeIds].join("\n");
}
