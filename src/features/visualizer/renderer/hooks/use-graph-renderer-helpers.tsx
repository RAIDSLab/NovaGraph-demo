import { useMemo } from "react";

import type { GraphEdge, GraphNode } from "../../types";
import type { DiffCategories, DiffCategory } from "../../compare/diff-overlay";
import {
  CRITICAL_RGBA,
  DIFF_CHANGED_RGBA,
  DIFF_DOWN_RGBA,
  DIFF_MISSING_RGBA,
  DIFF_STABLE_RGBA,
  DIFF_UP_RGBA,
  DISABLED_RGBA,
  GRADIENT_LUT_SIZE,
  GRADIENT_MAX_RGBA,
  NEUTRAL_RGBA,
  PRIMARY_LOW_RGBA,
  gradientIndex,
  gradientRgbaByIndex,
  rainbowIndex,
  rainbowRgbaByIndex,
  type Rgba,
} from "../lib/color-lut";

import { MODE, type ColorMap, type SizeMap } from "~/igraph/types";

const DEFAULT_NODE_SIZE = 7;
const INACTIVE_NODE_SIZE = 7;
const HIGHLIGHTED_LINK_WIDTH = 4;
const DEFAULT_LINK_WIDTH = 1;

/** Below this edge count, a full scan is cheaper than building a key index. */
const SPARSE_EDGE_INDEX_MIN_EDGES = 512;
/**
 * When colorMap edge keys exceed this fraction of |E|, scan all edges instead
 * (similar total work, fewer index allocations).
 */
const SPARSE_EDGE_DENSE_RATIO = 0.35;
const COLOR_IDX_SENTINEL_DISABLED = 0xfffd;
const COLOR_IDX_SENTINEL_CRITICAL = 0xfffc;
const COLOR_IDX_SENTINEL_NEUTRAL = 0xfffb;
const COLOR_IDX_SENTINEL_GRADIENT_MAX = 0xfffa;

/** Compare-diff categories get their own sentinels so they survive any mode. */
const DIFF_COLOR_SENTINELS: Record<DiffCategory, number> = {
  up: 0xfff9,
  down: 0xfff8,
  changed: 0xfff7,
  stable: 0xfff6,
  missing: 0xfff5,
};

const DIFF_SENTINEL_RGBA = new Map<number, Rgba>([
  [DIFF_COLOR_SENTINELS.up, DIFF_UP_RGBA],
  [DIFF_COLOR_SENTINELS.down, DIFF_DOWN_RGBA],
  [DIFF_COLOR_SENTINELS.changed, DIFF_CHANGED_RGBA],
  [DIFF_COLOR_SENTINELS.stable, DIFF_STABLE_RGBA],
  [DIFF_COLOR_SENTINELS.missing, DIFF_MISSING_RGBA],
]);

const parseEdgeColorMapKey = (key: string): [string, string] | null => {
  const sep = key.indexOf("-");
  if (sep < 0) return null;
  return [key.slice(0, sep), key.slice(sep + 1)];
};

type LinkStyle = { color: Rgba | null; width: number };

/** Mirrors legacy per-edge rules (fwd/bwd colorMap lookup). */
const linkStyleForEdge = (
  edge: GraphEdge,
  colors: ColorMap,
  directed: boolean
): LinkStyle => {
  const fwdValue = colors[`${edge.source}-${edge.target}`];
  const bwdValue = colors[`${edge.target}-${edge.source}`];

  let color: Rgba | null = null;
  if (fwdValue > 0) color = PRIMARY_LOW_RGBA;
  else if (!directed && bwdValue > 0) color = PRIMARY_LOW_RGBA;
  else if (bwdValue === 0) color = GRADIENT_MAX_RGBA;
  else if (!directed && fwdValue === 0) color = GRADIENT_MAX_RGBA;

  let width = DEFAULT_LINK_WIDTH;
  if (fwdValue >= 0) width = HIGHLIGHTED_LINK_WIDTH;
  else if (!directed && bwdValue >= 0) width = HIGHLIGHTED_LINK_WIDTH;

  return { color, width };
};

const buildEdgeByForwardKey = (edges: GraphEdge[]): Map<string, GraphEdge> => {
  const map = new Map<string, GraphEdge>();
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    map.set(`${edge.source}-${edge.target}`, edge);
  }
  return map;
};

const resolveEdgeFromKey = (
  from: string,
  to: string,
  edgeByForwardKey: Map<string, GraphEdge>,
  directed: boolean
): GraphEdge | undefined =>
  edgeByForwardKey.get(`${from}-${to}`) ??
  (!directed ? edgeByForwardKey.get(`${to}-${from}`) : undefined);

const applySparseEdgeStyles = (
  colors: ColorMap,
  directed: boolean,
  edgeByForwardKey: Map<string, GraphEdge>
): {
  linkColorByEdge: Map<GraphEdge, Rgba | null>;
  linkWidthByEdge: Map<GraphEdge, number>;
} => {
  const linkColorByEdge = new Map<GraphEdge, Rgba | null>();
  const linkWidthByEdge = new Map<GraphEdge, number>();
  const styled = new Set<GraphEdge>();

  for (const key in colors) {
    if (key.indexOf("-") < 0) continue;
    const endpoints = parseEdgeColorMapKey(key);
    if (!endpoints) continue;
    const [from, to] = endpoints;
    const edge = resolveEdgeFromKey(from, to, edgeByForwardKey, directed);
    if (!edge || styled.has(edge)) continue;

    const { color, width } = linkStyleForEdge(edge, colors, directed);
    linkColorByEdge.set(edge, color);
    linkWidthByEdge.set(edge, width);
    styled.add(edge);
  }

  return { linkColorByEdge, linkWidthByEdge };
};

const applyDenseEdgeStyles = (
  edges: GraphEdge[],
  colors: ColorMap,
  directed: boolean
): {
  linkColorByEdge: Map<GraphEdge, Rgba | null>;
  linkWidthByEdge: Map<GraphEdge, number>;
} => {
  const linkColorByEdge = new Map<GraphEdge, Rgba | null>();
  const linkWidthByEdge = new Map<GraphEdge, number>();
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    const { color, width } = linkStyleForEdge(edge, colors, directed);
    linkColorByEdge.set(edge, color);
    linkWidthByEdge.set(edge, width);
  }
  return { linkColorByEdge, linkWidthByEdge };
};

const defaultNodeColorForMode = (mode: number): Rgba => {
  switch (mode) {
    case MODE.COLOR_SHADE_DEFAULT:
      return DISABLED_RGBA;
    case MODE.COLOR_SHADE_ERROR:
      return CRITICAL_RGBA;
    case MODE.COLOR_IMPORTANT:
    case MODE.SIZE_SCALAR:
    case MODE.RAINBOW:
    default:
      return NEUTRAL_RGBA;
  }
};

const nodeColorIndexForValue = (mode: number, value: number): number => {
  switch (mode) {
    case MODE.COLOR_IMPORTANT:
      if (value > 0) return COLOR_IDX_SENTINEL_GRADIENT_MAX;
      if (value < 0) return COLOR_IDX_SENTINEL_CRITICAL;
      return COLOR_IDX_SENTINEL_NEUTRAL;
    case MODE.COLOR_SHADE_DEFAULT:
      return Number.isNaN(value)
        ? COLOR_IDX_SENTINEL_DISABLED
        : gradientIndex(value);
    case MODE.COLOR_SHADE_ERROR:
      return Number.isNaN(value)
        ? COLOR_IDX_SENTINEL_CRITICAL
        : gradientIndex(value);
    case MODE.SIZE_SCALAR:
      return COLOR_IDX_SENTINEL_NEUTRAL;
    case MODE.RAINBOW:
      return Number.isFinite(value)
        ? GRADIENT_LUT_SIZE + rainbowIndex(value)
        : COLOR_IDX_SENTINEL_NEUTRAL;
    default:
      return COLOR_IDX_SENTINEL_NEUTRAL;
  }
};

const nodeColorFromIndex = (mode: number, colorIdx: number): Rgba => {
  if (colorIdx === COLOR_IDX_SENTINEL_DISABLED) return DISABLED_RGBA;
  if (colorIdx === COLOR_IDX_SENTINEL_CRITICAL) return CRITICAL_RGBA;
  if (colorIdx === COLOR_IDX_SENTINEL_NEUTRAL) return NEUTRAL_RGBA;
  if (colorIdx === COLOR_IDX_SENTINEL_GRADIENT_MAX) return GRADIENT_MAX_RGBA;
  const diffRgba = DIFF_SENTINEL_RGBA.get(colorIdx);
  if (diffRgba) return diffRgba;

  switch (mode) {
    case MODE.COLOR_SHADE_DEFAULT:
    case MODE.COLOR_SHADE_ERROR:
      return gradientRgbaByIndex(colorIdx);
    case MODE.RAINBOW:
      return rainbowRgbaByIndex(colorIdx - GRADIENT_LUT_SIZE);
    case MODE.COLOR_IMPORTANT:
    case MODE.SIZE_SCALAR:
    default:
      return NEUTRAL_RGBA;
  }
};

export const hasVisualizationOverlay = (
  colors: ColorMap,
  sizes: SizeMap,
  mode: number,
  diffCategories?: DiffCategories | null
): boolean =>
  mode !== MODE.COLOR_SHADE_DEFAULT ||
  Object.keys(colors).length > 0 ||
  Object.keys(sizes).length > 0 ||
  (diffCategories != null && Object.keys(diffCategories).length > 0);

type GraphTopologyBase = {
  nodeIdToIndex: Map<string, number>;
  /** Pre-built for sparse edge overlay on large graphs. */
  edgeByForwardKey: Map<string, GraphEdge> | null;
  edgeCount: number;
};

const buildTopologyBase = (
  nodes: GraphNode[],
  edges: GraphEdge[]
): GraphTopologyBase => {
  const nodeCount = nodes.length;
  const edgeCount = edges.length;
  const nodeIdToIndex = new Map<string, number>();
  for (let i = 0; i < nodeCount; i++) {
    nodeIdToIndex.set(nodes[i].id, i);
  }

  const edgeByForwardKey =
    edgeCount >= SPARSE_EDGE_INDEX_MIN_EDGES
      ? buildEdgeByForwardKey(edges)
      : null;

  return { nodeIdToIndex, edgeByForwardKey, edgeCount };
};

type VisualizationOverlay = {
  nodeColorIndexBuffer: Uint16Array;
  nodeColorAssigned: Uint8Array;
  nodeSizeBuffer: Float32Array;
  nodeSizeAssigned: Uint8Array;
  /** Nodes with a finite colorMap value (COLOR_SHADE_DEFAULT size activation). */
  finiteColoredNodeFlags: Uint8Array;
  linkColorByEdge: Map<GraphEdge, Rgba | null>;
  linkWidthByEdge: Map<GraphEdge, number>;
};

const buildVisualizationOverlay = (
  base: GraphTopologyBase,
  edges: GraphEdge[],
  colors: ColorMap,
  sizes: SizeMap,
  mode: number,
  directed: boolean,
  diffCategories?: DiffCategories | null
): VisualizationOverlay => {
  const nodeCount = base.nodeIdToIndex.size;
  const nodeColorIndexBuffer = new Uint16Array(nodeCount);
  const nodeColorAssigned = new Uint8Array(nodeCount);
  const nodeSizeBuffer = new Float32Array(nodeCount);
  const nodeSizeAssigned = new Uint8Array(nodeCount);
  const finiteColoredNodeFlags = new Uint8Array(nodeCount);

  let colorMapEdgeKeyCount = 0;
  for (const key in colors) {
    if (key.indexOf("-") >= 0) {
      colorMapEdgeKeyCount++;
      continue;
    }
    const idx = base.nodeIdToIndex.get(key);
    if (idx === undefined) continue;
    const value = colors[key];
    nodeColorIndexBuffer[idx] = nodeColorIndexForValue(mode, value);
    nodeColorAssigned[idx] = 1;
    if (Number.isFinite(value)) finiteColoredNodeFlags[idx] = 1;
  }

  for (const key in sizes) {
    const idx = base.nodeIdToIndex.get(key);
    if (idx === undefined) continue;
    const size = sizes[key];
    if (size) {
      nodeSizeBuffer[idx] = size;
      nodeSizeAssigned[idx] = 1;
    }
  }

  // Composited last so the diff wins over the algorithm colour for the nodes it
  // covers, while every other node keeps its algorithm colour. Edges are left
  // alone because a diff is node-level.
  if (diffCategories) {
    for (const key in diffCategories) {
      const idx = base.nodeIdToIndex.get(key);
      if (idx === undefined) continue;
      nodeColorIndexBuffer[idx] = DIFF_COLOR_SENTINELS[diffCategories[key]];
      nodeColorAssigned[idx] = 1;
      // Keeps COLOR_SHADE_DEFAULT from shrinking diffed nodes to inactive size.
      finiteColoredNodeFlags[idx] = 1;
    }
  }

  const emptyEdgeMaps = {
    linkColorByEdge: new Map<GraphEdge, Rgba | null>(),
    linkWidthByEdge: new Map<GraphEdge, number>(),
  };

  let linkColorByEdge = emptyEdgeMaps.linkColorByEdge;
  let linkWidthByEdge = emptyEdgeMaps.linkWidthByEdge;

  if (colorMapEdgeKeyCount > 0 && base.edgeCount > 0) {
    const useSparseEdges =
      base.edgeCount >= SPARSE_EDGE_INDEX_MIN_EDGES &&
      colorMapEdgeKeyCount <
        Math.max(64, Math.floor(base.edgeCount * SPARSE_EDGE_DENSE_RATIO));

    if (useSparseEdges) {
      const edgeByForwardKey =
        base.edgeByForwardKey ?? buildEdgeByForwardKey(edges);
      ({ linkColorByEdge, linkWidthByEdge } = applySparseEdgeStyles(
        colors,
        directed,
        edgeByForwardKey
      ));
    } else {
      ({ linkColorByEdge, linkWidthByEdge } = applyDenseEdgeStyles(
        edges,
        colors,
        directed
      ));
    }
  }

  return {
    nodeColorIndexBuffer,
    nodeColorAssigned,
    nodeSizeBuffer,
    nodeSizeAssigned,
    finiteColoredNodeFlags,
    linkColorByEdge,
    linkWidthByEdge,
  };
};

export type GraphRendererAccessors = {
  nodeColor: (node: GraphNode, index: number) => Rgba;
  nodeSize: (node: GraphNode, index: number) => number;
  linkColor: (link: GraphEdge) => Rgba | null;
  linkWidth: (link: GraphEdge) => number;
};

export const useGraphRendererHelpers = ({
  nodes,
  edges,
  colors,
  sizes,
  mode,
  directed,
  diffCategories,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  colors: ColorMap;
  sizes: SizeMap;
  mode: number;
  directed: boolean;
  /** Optional compare-diff layer composited over the algorithm colours. */
  diffCategories?: DiffCategories | null;
}): GraphRendererAccessors => {
  // Base: topology only — rebuilt when nodes/edges change (graph edit / load).
  const topologyBase = useMemo(
    () => buildTopologyBase(nodes, edges),
    [nodes, edges]
  );

  const hasOverlay = hasVisualizationOverlay(
    colors,
    sizes,
    mode,
    diffCategories
  );

  // Overlay: algorithm / query visualization — patched on top of base defaults.
  const overlay = useMemo(() => {
    if (!hasOverlay) return null;
    return buildVisualizationOverlay(
      topologyBase,
      edges,
      colors,
      sizes,
      mode,
      directed,
      diffCategories
    );
  }, [
    topologyBase,
    edges,
    colors,
    sizes,
    mode,
    directed,
    diffCategories,
    hasOverlay,
  ]);

  return useMemo<GraphRendererAccessors>(() => {
    const fallbackColor = defaultNodeColorForMode(mode);

    if (!overlay) {
      // Cleared result: base layer only (inactive nodes, no link highlight).
      return {
        nodeColor: () => DISABLED_RGBA,
        nodeSize: () => INACTIVE_NODE_SIZE,
        linkColor: () => null,
        linkWidth: () => DEFAULT_LINK_WIDTH,
      };
    }

    const {
      nodeColorIndexBuffer,
      nodeColorAssigned,
      nodeSizeBuffer,
      nodeSizeAssigned,
      finiteColoredNodeFlags,
      linkColorByEdge,
      linkWidthByEdge,
    } = overlay;

    return {
      nodeColor: (_node, index) =>
        nodeColorAssigned[index] === 1
          ? nodeColorFromIndex(mode, nodeColorIndexBuffer[index])
          : fallbackColor,
      nodeSize: (_node, index) => {
        if (nodeSizeAssigned[index] === 1) {
          return nodeSizeBuffer[index];
        }
        if (mode === MODE.COLOR_SHADE_DEFAULT) {
          return finiteColoredNodeFlags[index] === 1
            ? DEFAULT_NODE_SIZE
            : INACTIVE_NODE_SIZE;
        }
        return DEFAULT_NODE_SIZE;
      },
      linkColor: (link) => linkColorByEdge.get(link) ?? null,
      linkWidth: (link) => linkWidthByEdge.get(link) ?? DEFAULT_LINK_WIDTH,
    };
  }, [overlay, mode]);
};
