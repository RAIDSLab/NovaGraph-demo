import {
  componentSteps,
  nodePathHopSteps,
  nodePrefixSteps,
  pathHopSteps,
} from "./helpers";
import { edgeKey, resolveLabel, resolveLabels } from "../build-label-to-id";
import type { SliceContext, SliceStep } from "../types";

import type { BFSOutputData } from "~/igraph/algorithms/PathFinding/IgraphBFS";
import type { DFSOutputData } from "~/igraph/algorithms/PathFinding/IgraphDFS";
import type { RandomWalkOutputData } from "~/igraph/algorithms/PathFinding/IgraphRandomWalk";
import type { DijkstraAToBOutputData } from "~/igraph/algorithms/PathFinding/IgraphDijkstraAtoB";
import type { DijkstraAToAllOutputData } from "~/igraph/algorithms/PathFinding/IgraphDijkstraAtoAll";
import type { BellmanFordAToBOutputData } from "~/igraph/algorithms/PathFinding/IgraphBellmanFordAtoB";
import type { BellmanFordAToAllOutputData } from "~/igraph/algorithms/PathFinding/IgraphBellmanFordAToAll";
import type { YenOutputData } from "~/igraph/algorithms/PathFinding/IgraphYen";
import type { MinimalSpanningTreeOutputData } from "~/igraph/algorithms/PathFinding/IgraphMST";
import type { TopologicalSortOutputData } from "~/igraph/algorithms/Misc/IgraphTopologicalSort";
import type { GraphDiameterOutputData } from "~/igraph/algorithms/Misc/IgraphDiameter";
import type { EulerianPathOutputData } from "~/igraph/algorithms/Misc/IgraphEulerianPath";
import type { EulerianCircuitOutputData } from "~/igraph/algorithms/Misc/IgraphEulerianCircuit";
import type { SCCOutputData } from "~/igraph/algorithms/Community/IgraphStronglyConnectedComponents";
import type { WCCOutputData } from "~/igraph/algorithms/Community/IgraphWeaklyConnectedComponents";

export function bfsSliceSteps(
  data: BFSOutputData,
  ctx: SliceContext
): SliceStep[] {
  return data.layers.map((layer, i) => ({
    index: i,
    nodes: resolveLabels(layer.layer, ctx.labelToId),
    edges: [],
    label: `Layer ${layer.index}`,
  }));
}

export function dfsSliceSteps(
  data: DFSOutputData,
  ctx: SliceContext
): SliceStep[] {
  return data.subtrees
    .map((subtree, i) => {
      const labels = subtree.tree.filter((t) => t !== "");
      return {
        index: i,
        nodes: resolveLabels(labels, ctx.labelToId),
        edges: [] as string[],
        label: `Subtree ${subtree.num}`,
      };
    })
    .filter((s) => s.nodes.length > 0)
    .map((s, i) => ({ ...s, index: i }));
}

export function randomWalkSliceSteps(
  data: RandomWalkOutputData,
  ctx: SliceContext
): SliceStep[] {
  return pathHopSteps(data.path, ctx, { sourceLabel: data.source });
}

export function topologicalSortSliceSteps(
  data: TopologicalSortOutputData,
  ctx: SliceContext
): SliceStep[] {
  return nodePrefixSteps(data.order, ctx, "Order");
}

export function sccSliceSteps(
  data: SCCOutputData,
  ctx: SliceContext
): SliceStep[] {
  return componentSteps(data.components, ctx);
}

export function wccSliceSteps(
  data: WCCOutputData,
  ctx: SliceContext
): SliceStep[] {
  return componentSteps(data.components, ctx);
}

export function dijkstraAToBSliceSteps(
  data: DijkstraAToBOutputData,
  ctx: SliceContext
): SliceStep[] {
  return pathHopSteps(data.path, ctx, { sourceLabel: data.source });
}

export function bellmanFordAToBSliceSteps(
  data: BellmanFordAToBOutputData,
  ctx: SliceContext
): SliceStep[] {
  return pathHopSteps(data.path, ctx, { sourceLabel: data.source });
}

export function graphDiameterSliceSteps(
  data: GraphDiameterOutputData,
  ctx: SliceContext
): SliceStep[] {
  return pathHopSteps(data.path, ctx, { sourceLabel: data.source });
}

export function eulerianPathSliceSteps(
  data: EulerianPathOutputData,
  ctx: SliceContext
): SliceStep[] {
  return pathHopSteps(data.path, ctx, { startLabel: data.start });
}

export function eulerianCircuitSliceSteps(
  data: EulerianCircuitOutputData,
  ctx: SliceContext
): SliceStep[] {
  return pathHopSteps(data.path, ctx);
}

/** Group A→All paths into hop-distance bands, then reveal cumulatively. */
export function aToAllHopBandSteps(
  data: DijkstraAToAllOutputData | BellmanFordAToAllOutputData,
  ctx: SliceContext
): SliceStep[] {
  const bandNodes = new Map<number, Set<string>>();
  const bandEdges = new Map<number, Set<string>>();

  const sourceId = resolveLabel(data.source, ctx.labelToId);
  if (sourceId != null) {
    bandNodes.set(0, new Set([sourceId]));
    bandEdges.set(0, new Set());
  }

  for (const entry of data.paths) {
    const nodePath = entry.path;
    if (nodePath.length === 0) continue;
    for (let i = 0; i < nodePath.length; i++) {
      const hop = i;
      if (!bandNodes.has(hop)) bandNodes.set(hop, new Set());
      if (!bandEdges.has(hop)) bandEdges.set(hop, new Set());
      const id = resolveLabel(nodePath[i], ctx.labelToId);
      if (id != null) bandNodes.get(hop)!.add(id);
      if (i > 0) {
        const fromId = resolveLabel(nodePath[i - 1], ctx.labelToId);
        const toId = resolveLabel(nodePath[i], ctx.labelToId);
        if (fromId != null && toId != null) {
          bandEdges.get(hop)!.add(edgeKey(fromId, toId));
        }
      }
    }
  }

  const hops = [...bandNodes.keys()].sort((a, b) => a - b);
  return hops.map((hop, i) => ({
    index: i,
    nodes: [...(bandNodes.get(hop) ?? [])],
    edges: [...(bandEdges.get(hop) ?? [])],
    label: `Hop ${hop}`,
  }));
}

export function dijkstraAToAllSliceSteps(
  data: DijkstraAToAllOutputData,
  ctx: SliceContext
): SliceStep[] {
  return aToAllHopBandSteps(data, ctx);
}

export function bellmanFordAToAllSliceSteps(
  data: BellmanFordAToAllOutputData,
  ctx: SliceContext
): SliceStep[] {
  return aToAllHopBandSteps(data, ctx);
}

export function yenSliceSteps(
  data: Pick<YenOutputData, "paths">,
  ctx: SliceContext
): SliceStep[] {
  return data.paths.map((entry, i) => {
    const nodes = resolveLabels(entry.path, ctx.labelToId);
    const edges: string[] = [];
    for (let j = 1; j < entry.path.length; j++) {
      const fromId = resolveLabel(entry.path[j - 1], ctx.labelToId);
      const toId = resolveLabel(entry.path[j], ctx.labelToId);
      if (fromId != null && toId != null) edges.push(edgeKey(fromId, toId));
    }
    return {
      index: i,
      nodes,
      edges,
      label: `Path ${entry.num}`,
    };
  });
}

export function mstSliceSteps(
  data: MinimalSpanningTreeOutputData,
  ctx: SliceContext
): SliceStep[] {
  const ordered = [...data.edges].sort((a, b) => a.num - b.num);
  return ordered.map((e, i) => {
    const fromId = resolveLabel(e.from, ctx.labelToId);
    const toId = resolveLabel(e.to, ctx.labelToId);
    const nodes: string[] = [];
    const edges: string[] = [];
    if (fromId != null) nodes.push(fromId);
    if (toId != null) nodes.push(toId);
    if (fromId != null && toId != null) edges.push(edgeKey(fromId, toId));
    return {
      index: i,
      nodes,
      edges,
      label: `Edge ${e.num}`,
    };
  });
}

// Re-export helpers used only in tests / external callers
export { nodePathHopSteps };
