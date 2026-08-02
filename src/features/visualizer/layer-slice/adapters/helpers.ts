import {
  edgeKey,
  resolveLabel,
  resolveLabels,
} from "../build-label-to-id";
import type { SliceContext, SliceStep } from "../types";

export function pathHopSteps(
  path: { from: string; to: string }[],
  ctx: SliceContext,
  options?: { sourceLabel?: string; startLabel?: string }
): SliceStep[] {
  const steps: SliceStep[] = [];
  const sourceLabel = options?.sourceLabel ?? options?.startLabel;

  if (sourceLabel) {
    const sourceId = resolveLabel(sourceLabel, ctx.labelToId);
    steps.push({
      index: 0,
      nodes: sourceId != null ? [sourceId] : [],
      edges: [],
      label: "Start",
    });
  } else if (path.length > 0) {
    const firstFrom = resolveLabel(path[0].from, ctx.labelToId);
    steps.push({
      index: 0,
      nodes: firstFrom != null ? [firstFrom] : [],
      edges: [],
      label: "Start",
    });
  }

  path.forEach((hop, i) => {
    const fromId = resolveLabel(hop.from, ctx.labelToId);
    const toId = resolveLabel(hop.to, ctx.labelToId);
    const nodes: string[] = [];
    const edges: string[] = [];
    if (toId != null) nodes.push(toId);
    if (fromId != null && toId != null) edges.push(edgeKey(fromId, toId));
    steps.push({
      index: steps.length,
      nodes,
      edges,
      label: `Hop ${i + 1}`,
    });
  });

  return steps;
}

export function nodePrefixSteps(
  labels: string[],
  ctx: SliceContext,
  labelPrefix = "Step"
): SliceStep[] {
  const steps: SliceStep[] = [];
  for (let i = 0; i < labels.length; i++) {
    const id = resolveLabel(labels[i], ctx.labelToId);
    if (id == null) continue;
    steps.push({
      index: steps.length,
      nodes: [id],
      edges: [],
      label: `${labelPrefix} ${i}`,
    });
  }
  return steps;
}

export function componentSteps(
  components: string[][],
  ctx: SliceContext
): SliceStep[] {
  return components
    .map((component, i) => ({
      index: i,
      nodes: resolveLabels(component, ctx.labelToId),
      edges: [] as string[],
      label: `Component ${i}`,
    }))
    .filter((s) => s.nodes.length > 0)
    .map((s, i) => ({ ...s, index: i }));
}

/** Convert a node-id path array into hop steps (consecutive pairs as edges). */
export function nodePathHopSteps(
  nodePath: string[],
  ctx: SliceContext
): SliceStep[] {
  if (nodePath.length === 0) return [];
  const steps: SliceStep[] = [];
  const firstId = resolveLabel(nodePath[0], ctx.labelToId);
  steps.push({
    index: 0,
    nodes: firstId != null ? [firstId] : [],
    edges: [],
    label: "Start",
  });
  for (let i = 1; i < nodePath.length; i++) {
    const fromId = resolveLabel(nodePath[i - 1], ctx.labelToId);
    const toId = resolveLabel(nodePath[i], ctx.labelToId);
    const nodes: string[] = [];
    const edges: string[] = [];
    if (toId != null) nodes.push(toId);
    if (fromId != null && toId != null) edges.push(edgeKey(fromId, toId));
    steps.push({
      index: steps.length,
      nodes,
      edges,
      label: `Hop ${i}`,
    });
  }
  return steps;
}
