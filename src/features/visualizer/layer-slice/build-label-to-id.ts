import type { GraphNode } from "~/features/visualizer/types";

/** Same format as `mapLabelBack` in igraph ID remapping. */
export function nodeDisplayLabel(node: GraphNode): string {
  return `${String(node._primaryKeyValue)} (${node.tableName})`;
}

export function buildLabelToIdMap(
  nodes: Iterable<GraphNode>
): Map<string, string> {
  const map = new Map<string, string>();
  for (const node of nodes) {
    map.set(nodeDisplayLabel(node), node.id);
  }
  return map;
}

export function resolveLabel(
  label: string,
  labelToId: Map<string, string>
): string | null {
  if (!label) return null;
  return labelToId.get(label) ?? null;
}

export function resolveLabels(
  labels: string[],
  labelToId: Map<string, string>
): string[] {
  const ids: string[] = [];
  for (const label of labels) {
    const id = resolveLabel(label, labelToId);
    if (id != null) ids.push(id);
  }
  return ids;
}

export function edgeKey(fromId: string, toId: string): string {
  return `${fromId}-${toId}`;
}
