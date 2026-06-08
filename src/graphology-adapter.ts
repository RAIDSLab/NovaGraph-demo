/**
 * Graphology-based adapter implementing the same interface as the WASM igraph module.
 * Used for the pure JS version of NovaGraph (no C++/WASM).
 *
 * Implements algorithms available in Graphology; unimplemented ones throw via notImplemented().
 */

import Graph from "graphology";
import dijkstra from "graphology-shortest-path/dijkstra";
import {
  bidirectional as unweightedBidirectional,
  singleSource as unweightedSingleSource,
  singleSourceLength,
} from "graphology-shortest-path/unweighted";
import leiden from "@aflsolutions/graphology-communities-leiden";
import louvain from "graphology-communities-louvain";
import modularity from "graphology-metrics/graph/modularity";
import {
  connectedComponents,
  stronglyConnectedComponents,
} from "graphology-components";
import { toUndirected } from "graphology-operators";
import { coreNumber } from "graphology-cores";
import { topologicalSort } from "graphology-dag";
import betweennessCentrality from "graphology-metrics/centrality/betweenness";
import closenessCentrality from "graphology-metrics/centrality/closeness";
import { degreeCentrality } from "graphology-metrics/centrality/degree";
import eigenvectorCentrality from "graphology-metrics/centrality/eigenvector";
import pagerank from "graphology-metrics/centrality/pagerank";
import {
  weightedDegree,
} from "graphology-metrics/node/weighted-degree";
import type { IGraphModule, IgraphRawAlgorithmResult } from "./igraph/types";
import { MODE } from "./igraph/types";

const WEIGHT_ATTR = "weight";

function nodeId(i: number): string {
  return String(i);
}

function nodeNum(s: string): number {
  return parseInt(s, 10);
}

function notImplemented(name: string): never {
  throw new Error(
    `[NovaGraph JS] Algorithm "${name}" is not implemented in the Graphology adapter.`
  );
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

type RelaxationEdge = { from: string; to: string; weight: number };

type MstEdge = { from: string; to: string; weight: number };

function requireUndirected(g: Graph, algorithm: string): void {
  if (g.type === "directed") {
    throw new Error(`${algorithm} requires an undirected graph.`);
  }
}

function edgeWeight(g: Graph, from: string, to: string, weightAttr?: string): number {
  if (!weightAttr) return 1;
  if (g.hasEdge(from, to)) {
    return (g.getEdgeAttribute(from, to, weightAttr) as number) ?? 1;
  }
  if (g.hasEdge(to, from)) {
    return (g.getEdgeAttribute(to, from, weightAttr) as number) ?? 1;
  }
  return 1;
}

function collectRelaxationEdges(
  g: Graph,
  directed: boolean,
  weightAttr?: string
): RelaxationEdge[] {
  const edges: RelaxationEdge[] = [];
  if (directed) {
    g.forEachDirectedEdge((_, attrs, source, target) => {
      edges.push({
        from: source,
        to: target,
        weight: weightAttr ? ((attrs[weightAttr] as number) ?? 1) : 1,
      });
    });
    return edges;
  }

  g.forEachEdge((_, attrs, source, target) => {
    const weight = weightAttr ? ((attrs[weightAttr] as number) ?? 1) : 1;
    edges.push({ from: source, to: target, weight });
    if (source !== target) {
      edges.push({ from: target, to: source, weight });
    }
  });
  return edges;
}

function bellmanFord(
  g: Graph,
  source: string,
  directed: boolean,
  weightAttr?: string
): { dist: Map<string, number>; prev: Map<string, string | null> } {
  const nodes = [...g.nodes()];
  const edges = collectRelaxationEdges(g, directed, weightAttr);
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();

  for (const node of nodes) {
    dist.set(node, Infinity);
    prev.set(node, null);
  }
  dist.set(source, 0);

  for (let i = 0; i < nodes.length - 1; i++) {
    let updated = false;
    for (const { from, to, weight } of edges) {
      const candidate = (dist.get(from) ?? Infinity) + weight;
      if (candidate < (dist.get(to) ?? Infinity)) {
        dist.set(to, candidate);
        prev.set(to, from);
        updated = true;
      }
    }
    if (!updated) break;
  }

  for (const { from, to, weight } of edges) {
    if ((dist.get(from) ?? Infinity) + weight < (dist.get(to) ?? Infinity)) {
      throw new Error(
        "Graph contains a negative weight cycle reachable from the source."
      );
    }
  }

  return { dist, prev };
}

function reconstructNodePath(
  dist: Map<string, number>,
  prev: Map<string, string | null>,
  target: string
): string[] | null {
  if ((dist.get(target) ?? Infinity) === Infinity) return null;
  const path: string[] = [];
  let current: string | null = target;
  while (current !== null) {
    path.unshift(current);
    current = prev.get(current) ?? null;
  }
  return path;
}

function pathToLinks(
  path: string[],
  g: Graph,
  weightAttr?: string
): { from: number; to: number; weight?: number }[] {
  const links: { from: number; to: number; weight?: number }[] = [];
  for (let i = 1; i < path.length; i++) {
    const link: { from: number; to: number; weight?: number } = {
      from: nodeNum(path[i - 1]),
      to: nodeNum(path[i]),
    };
    if (weightAttr) {
      link.weight = edgeWeight(g, path[i - 1], path[i], weightAttr);
    }
    links.push(link);
  }
  return links;
}

function pathTotalWeight(path: string[], g: Graph, weightAttr?: string): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += edgeWeight(g, path[i - 1], path[i], weightAttr);
  }
  return total;
}

function collectUndirectedMstEdges(g: Graph, weightAttr?: string): MstEdge[] {
  const analysisGraph = g.type !== "undirected" ? toUndirected(g) : g;
  const edges: MstEdge[] = [];
  const seen = new Set<string>();

  analysisGraph.forEachEdge((_, attrs, source, target) => {
    const a = nodeNum(source);
    const b = nodeNum(target);
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({
      from: source,
      to: target,
      weight: weightAttr ? ((attrs[weightAttr] as number) ?? 1) : 1,
    });
  });

  return edges;
}

function kruskalMst(g: Graph, weightAttr?: string): MstEdge[] {
  const edges = collectUndirectedMstEdges(g, weightAttr).sort(
    (a, b) => a.weight - b.weight
  );
  const parent = new Map<string, string>();
  for (const node of g.nodes()) parent.set(node, node);

  const find = (node: string): string => {
    const parentNode = parent.get(node)!;
    if (parentNode !== node) parent.set(node, find(parentNode));
    return parent.get(node)!;
  };

  const mst: MstEdge[] = [];
  for (const edge of edges) {
    const rootFrom = find(edge.from);
    const rootTo = find(edge.to);
    if (rootFrom !== rootTo) {
      parent.set(rootFrom, rootTo);
      mst.push(edge);
    }
  }
  return mst;
}

function directedEdgeKey(from: number, to: number): string {
  return `${from}-${to}`;
}

function shortestPathWithConstraints(
  g: Graph,
  src: string,
  tar: string,
  weightAttr: string | undefined,
  bannedEdges: Set<string>,
  bannedNodes: Set<string>
): string[] | null {
  if (bannedNodes.has(src) || bannedNodes.has(tar)) return null;

  const directed = g.type === "directed";
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const visited = new Set<string>();

  for (const node of g.nodes()) {
    if (!bannedNodes.has(node)) {
      dist.set(node, Infinity);
      prev.set(node, null);
    }
  }
  dist.set(src, 0);

  const queue: string[] = [src];
  while (queue.length > 0) {
    queue.sort((a, b) => (dist.get(a) ?? Infinity) - (dist.get(b) ?? Infinity));
    const node = queue.shift()!;
    if (visited.has(node)) continue;
    visited.add(node);
    if (node === tar) break;

    const neighbors = directed ? g.outboundNeighbors(node) : g.neighbors(node);
    for (const neighbor of neighbors) {
      if (bannedNodes.has(neighbor)) continue;
      const key = directedEdgeKey(nodeNum(node), nodeNum(neighbor));
      if (bannedEdges.has(key)) continue;

      const nextDist = (dist.get(node) ?? Infinity) + edgeWeight(g, node, neighbor, weightAttr);
      if (nextDist < (dist.get(neighbor) ?? Infinity)) {
        dist.set(neighbor, nextDist);
        prev.set(neighbor, node);
        queue.push(neighbor);
      }
    }
  }

  return reconstructNodePath(dist, prev, tar);
}

function yenKShortestPaths(
  g: Graph,
  src: number,
  tar: number,
  k: number,
  weightAttr?: string
): { path: string[]; weight?: number }[] {
  const srcStr = nodeId(src);
  const tarStr = nodeId(tar);
  const found: string[][] = [];
  const candidates: { path: string[]; weight: number }[] = [];

  const first = shortestPathWithConstraints(g, srcStr, tarStr, weightAttr, new Set(), new Set());
  if (!first) return [];
  found.push(first);

  for (let pathIndex = 1; pathIndex < k; pathIndex++) {
    const previous = found[pathIndex - 1];

    for (let spurIndex = 0; spurIndex < previous.length - 1; spurIndex++) {
      const spurNode = previous[spurIndex];
      const root = previous.slice(0, spurIndex + 1);
      const bannedEdges = new Set<string>();
      const bannedNodes = new Set<string>();

      for (const path of found) {
        if (path.length <= spurIndex) continue;
        let matches = true;
        for (let i = 0; i <= spurIndex; i++) {
          if (path[i] !== root[i]) {
            matches = false;
            break;
          }
        }
        if (!matches) continue;
        if (path.length > spurIndex + 1) {
          bannedEdges.add(directedEdgeKey(nodeNum(path[spurIndex]), nodeNum(path[spurIndex + 1])));
        }
      }

      for (let i = 0; i < spurIndex; i++) {
        bannedNodes.add(previous[i]);
      }

      const spurPath = shortestPathWithConstraints(
        g,
        spurNode,
        tarStr,
        weightAttr,
        bannedEdges,
        bannedNodes
      );
      if (!spurPath) continue;

      const totalPath = [...root.slice(0, -1), ...spurPath];
      const weight = pathTotalWeight(totalPath, g, weightAttr);
      candidates.push({ path: totalPath, weight });
    }

    if (candidates.length === 0) break;
    candidates.sort((a, b) => a.weight - b.weight);
    const next = candidates.shift()!;
    found.push(next.path);
  }

  return found.map((path) => ({
    path,
    ...(weightAttr ? { weight: pathTotalWeight(path, g, weightAttr) } : {}),
  }));
}

function buildAdjacencyLists(g: Graph, directed: boolean): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  for (const node of g.nodes()) adjacency.set(node, []);

  if (directed) {
    g.forEachDirectedEdge((_, __, source, target) => {
      adjacency.get(source)!.push(target);
    });
    return adjacency;
  }

  g.forEachEdge((_, __, source, target) => {
    adjacency.get(source)!.push(target);
    adjacency.get(target)!.push(source);
  });
  return adjacency;
}

function hierholzerTour(
  adjacency: Map<string, string[]>,
  start: string,
  directed: boolean
): string[] {
  const localAdjacency = new Map<string, string[]>();
  for (const [node, neighbors] of adjacency) {
    localAdjacency.set(node, [...neighbors]);
  }

  const stack = [start];
  const tour: string[] = [];
  while (stack.length > 0) {
    const node = stack[stack.length - 1];
    const neighbors = localAdjacency.get(node) ?? [];
    if (neighbors.length > 0) {
      const next = neighbors.pop()!;
      if (!directed) {
        const reverse = localAdjacency.get(next) ?? [];
        const index = reverse.lastIndexOf(node);
        if (index >= 0) reverse.splice(index, 1);
      }
      stack.push(next);
    } else {
      tour.push(stack.pop()!);
    }
  }
  return tour.reverse();
}

function isWeaklyConnected(g: Graph): boolean {
  if (g.order === 0) return true;
  const undirected = g.type !== "undirected" ? toUndirected(g) : g;
  return connectedComponents(undirected).length <= 1;
}

function eulerianStatus(g: Graph): { hasPath: boolean; hasCircuit: boolean } {
  if (g.size === 0) return { hasPath: true, hasCircuit: true };
  if (!isWeaklyConnected(g)) return { hasPath: false, hasCircuit: false };

  const directed = g.type === "directed";
  if (directed) {
    let startExcess = 0;
    let endExcess = 0;
    for (const node of g.nodes()) {
      let outDegree = 0;
      let inDegree = 0;
      g.forEachDirectedEdge((_, __, source, target) => {
        if (source === node) outDegree++;
        if (target === node) inDegree++;
      });
      const diff = outDegree - inDegree;
      if (diff > 1 || diff < -1) return { hasPath: false, hasCircuit: false };
      if (diff === 1) startExcess++;
      if (diff === -1) endExcess++;
    }
    const hasCircuit = startExcess === 0 && endExcess === 0;
    const hasPath = hasCircuit || (startExcess <= 1 && endExcess <= 1);
    return { hasPath, hasCircuit };
  }

  let odd = 0;
  for (const node of g.nodes()) {
    if (g.degree(node) % 2 !== 0) odd++;
  }
  const hasCircuit = odd === 0;
  const hasPath = hasCircuit || odd === 2;
  return { hasPath, hasCircuit };
}

function eulerianStartNode(g: Graph, needCircuit: boolean): string | null {
  const nodes = [...g.nodes()];
  if (nodes.length === 0) return null;

  const directed = g.type === "directed";
  if (needCircuit) {
    for (const node of nodes) {
      const degree = directed ? g.outDegree(node) : g.degree(node);
      if (degree > 0) return node;
    }
    return nodes[0];
  }

  if (directed) {
    for (const node of nodes) {
      let outDegree = 0;
      let inDegree = 0;
      g.forEachDirectedEdge((_, __, source, target) => {
        if (source === node) outDegree++;
        if (target === node) inDegree++;
      });
      if (outDegree - inDegree === 1) return node;
    }
    for (const node of nodes) {
      if (g.outDegree(node) > 0) return node;
    }
    return nodes[0];
  }

  for (const node of nodes) {
    if (g.degree(node) % 2 !== 0) return node;
  }
  for (const node of nodes) {
    if (g.degree(node) > 0) return node;
  }
  return nodes[0];
}

function communitiesFromLabels(
  labels: Map<string, number>
): { colorMap: Record<string, number>; communities: number[][] } {
  const colorMap: Record<string, number> = {};
  const communityMap = new Map<number, number[]>();

  for (const [node, label] of labels) {
    const numericNode = nodeNum(node);
    colorMap[nodeId(numericNode)] = label;
    if (!communityMap.has(label)) communityMap.set(label, []);
    communityMap.get(label)!.push(numericNode);
  }

  const communities = [...communityMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, members]) => members);

  return { colorMap, communities };
}

function fastGreedyCommunities(
  g: Graph,
  weightAttr?: string
): { labels: Map<string, number>; modularityScore: number } {
  const analysisGraph = g.type !== "undirected" ? toUndirected(g) : g;
  const labels = new Map<string, number>();
  let nextLabel = 0;
  for (const node of analysisGraph.nodes()) {
    labels.set(node, nextLabel++);
  }

  let currentModularity = modularity(analysisGraph, {
    getNodeCommunity: (node) => labels.get(node)!,
    getEdgeWeight: weightAttr ?? null,
  });

  let improved = true;
  while (improved) {
    improved = false;
    let bestDelta = 0;
    let mergeFrom = -1;
    let mergeInto = -1;
    const pairKeys = new Set<string>();

    analysisGraph.forEachEdge((_, __, source, target) => {
      const left = labels.get(source)!;
      const right = labels.get(target)!;
      if (left === right) return;
      const key = left < right ? `${left}:${right}` : `${right}:${left}`;
      pairKeys.add(key);
    });

    for (const key of pairKeys) {
      const [left, right] = key.split(":").map(Number);
      const trial = new Map(labels);
      for (const [node, label] of trial) {
        if (label === right) trial.set(node, left);
      }
      const trialModularity = modularity(analysisGraph, {
        getNodeCommunity: (node) => trial.get(node)!,
        getEdgeWeight: weightAttr ?? null,
      });
      const delta = trialModularity - currentModularity;
      if (delta > bestDelta) {
        bestDelta = delta;
        mergeInto = left;
        mergeFrom = right;
        improved = true;
      }
    }

    if (improved && bestDelta > 0 && mergeFrom >= 0 && mergeInto >= 0) {
      for (const [node, label] of labels) {
        if (label === mergeFrom) labels.set(node, mergeInto);
      }
      currentModularity += bestDelta;
    } else {
      improved = false;
    }
  }

  return { labels, modularityScore: currentModularity };
}

function frequenciesToColorMap(
  frequencies: Record<number, number>,
  colorMap: Record<string, number>
): void {
  const maxFreq = Math.max(0, ...Object.values(frequencies));
  if (maxFreq === 0) return;
  for (const [node, freq] of Object.entries(frequencies)) {
    colorMap[nodeId(parseInt(node, 10))] = freq / maxFreq;
  }
}

function doublesToColorMap(
  values: Record<number, number>,
  colorMap: Record<string, number>
): void {
  const max = Math.max(0, ...Object.values(values));
  if (max === 0) return;
  for (const [node, value] of Object.entries(values)) {
    colorMap[nodeId(parseInt(node, 10))] = value / max;
  }
}

function pickRandomNeighbor(
  g: Graph,
  node: string,
  directed: boolean,
  weightAttr?: string
): string | null {
  const neighbors = directed
    ? [...g.outboundNeighbors(node)]
    : [...g.neighbors(node)];
  if (neighbors.length === 0) return null;

  if (!weightAttr) {
    return neighbors[Math.floor(Math.random() * neighbors.length)];
  }

  const weights = neighbors.map(
    (neighbor) => g.getEdgeAttribute(node, neighbor, weightAttr) ?? 1
  );
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) {
    return neighbors[Math.floor(Math.random() * neighbors.length)];
  }

  let threshold = Math.random() * total;
  for (let i = 0; i < neighbors.length; i++) {
    threshold -= weights[i];
    if (threshold <= 0) return neighbors[i];
  }
  return neighbors[neighbors.length - 1];
}

function localClusteringForNode(g: Graph, node: string): number {
  const neighbors = [...g.neighbors(node)];
  const degree = neighbors.length;
  if (degree < 2) return 0;

  const neighborSet = new Set(neighbors);
  let edgesBetween = 0;
  for (const u of neighbors) {
    for (const v of g.neighbors(u)) {
      if (neighborSet.has(v) && u < v) edgesBetween++;
    }
  }

  return (2 * edgesBetween) / (degree * (degree - 1));
}

function neighborsAreConnected(g: Graph, a: string, b: string): boolean {
  return g.hasEdge(a, b) || g.hasEdge(b, a) || g.hasUndirectedEdge(a, b);
}

function makeResult(
  data: Record<string, unknown>,
  colorMap: Record<string, number>,
  mode: number,
  sizeMap?: Record<string, number>
): IgraphRawAlgorithmResult {
  const result: IgraphRawAlgorithmResult = { data, colorMap, mode };
  if (sizeMap) result.sizeMap = sizeMap;
  return result;
}

export class GraphologyAdapter implements IGraphModule {
  private _graph: Graph | null = null;
  private _hasWeights = false;

  what_to_stderr(_ptr: number): string {
    return "Graphology adapter error";
  }

  cleanupGraph(): void {
    this._graph = null;
    this._hasWeights = false;
  }

  create_graph_from_kuzu_to_igraph(
    nodesCount: number,
    src: Int32Array,
    dst: Int32Array,
    directed: boolean,
    weight?: Float64Array | Float32Array
  ): void {
    this._graph = new Graph({
      type: directed ? "directed" : "undirected",
      multi: false,
    });

    for (let i = 0; i < nodesCount; i++) {
      this._graph.addNode(nodeId(i));
    }

    const E = src.length;
    this._hasWeights = !!weight;
    for (let i = 0; i < E; i++) {
      const s = nodeId(src[i]);
      const t = nodeId(dst[i]);
      const attrs: Record<string, number> = {};
      if (weight && weight[i] !== undefined) {
        attrs[WEIGHT_ATTR] = weight[i];
      }
      if (!this._graph.hasEdge(s, t)) {
        this._graph.addEdge(s, t, attrs);
      }
    }
  }

  private _ensureGraph(): Graph {
    if (!this._graph) throw new Error("Graph not initialized. Call create_graph_from_kuzu_to_igraph first.");
    return this._graph;
  }

  private _getWeightAttr(): string | undefined {
    return this._hasWeights ? WEIGHT_ATTR : undefined;
  }

  async dijkstra_source_to_target(src: number, tar: number): Promise<IgraphRawAlgorithmResult> {
    const g = this._ensureGraph();
    const srcStr = nodeId(src);
    const tarStr = nodeId(tar);
    const weightAttr = this._getWeightAttr();

    const path = weightAttr
      ? dijkstra.bidirectional(g, srcStr, tarStr, weightAttr)
      : unweightedBidirectional(g, srcStr, tarStr);

    const colorMap: Record<string, number> = {};
    const pathEdges: { from: number; to: number; weight?: number }[] = [];
    let totalWeight = 0;

    if (path && path.length > 0) {
      for (let i = 0; i < path.length; i++) {
        const n = path[i];
        colorMap[nodeId(nodeNum(n))] = i === 0 || i === path.length - 1 ? 1 : 0.5;
      }
      for (let i = 1; i < path.length; i++) {
        const from = nodeNum(path[i - 1]);
        const to = nodeNum(path[i]);
        const linkId = `${from}-${to}`;
        colorMap[linkId] = 1;
        let w: number | undefined;
        if (weightAttr && g.hasEdge(path[i - 1], path[i])) {
          w = g.getEdgeAttribute(path[i - 1], path[i], WEIGHT_ATTR) ?? 0;
          totalWeight += w ?? 0;
        }
        pathEdges.push({ from, to, weight: w });
      }
    }

    colorMap[nodeId(src)] = 1;
    colorMap[nodeId(tar)] = 1;

    const data: Record<string, unknown> = {
      algorithm: "Dijkstra Single Path",
      source: src,
      target: tar,
      weighted: this._hasWeights,
      path: pathEdges,
    };
    if (this._hasWeights) data.totalWeight = totalWeight;

    return makeResult(data, colorMap, MODE.COLOR_SHADE_DEFAULT);
  }

  async dijkstra_source_to_all(src: number): Promise<IgraphRawAlgorithmResult> {
    const g = this._ensureGraph();
    const srcStr = nodeId(src);
    const weightAttr = this._getWeightAttr();

    const paths = weightAttr
      ? dijkstra.singleSource(g, srcStr, weightAttr)
      : unweightedSingleSource(g, srcStr);

    const colorMap: Record<string, number> = {};
    const pathsArray: { target: number; path: { from: number; to: number; weight?: number }[]; totalWeight?: number }[] = [];
    const freq: Record<number, number> = {};

    for (const [targetStr, path] of Object.entries(paths)) {
      if (!path || path.length === 0) continue;
      const target = nodeNum(targetStr);
      freq[target] = (freq[target] ?? 0) + 1;
      const pathEdges: { from: number; to: number; weight?: number }[] = [];
      let totalWeight = 0;
      for (let i = 1; i < path.length; i++) {
        const from = nodeNum(path[i - 1]);
        const to = nodeNum(path[i]);
        let w: number | undefined;
        if (weightAttr && g.hasEdge(path[i - 1], path[i])) {
          w = g.getEdgeAttribute(path[i - 1], path[i], WEIGHT_ATTR) ?? 0;
          totalWeight += w ?? 0;
        }
        pathEdges.push({ from, to, weight: w });
      }
      pathsArray.push({
        target,
        path: pathEdges,
        ...(this._hasWeights && { totalWeight }),
      });
    }

    const maxFreq = Math.max(0, ...Object.values(freq));
    for (const [n, f] of Object.entries(freq)) {
      colorMap[nodeId(parseInt(n, 10))] = maxFreq > 0 ? f / maxFreq : 1;
    }
    colorMap[nodeId(src)] = 1;

    const data: Record<string, unknown> = {
      algorithm: "Dijkstra Single Source",
      source: src,
      weighted: this._hasWeights,
      paths: pathsArray,
    };
    return makeResult(data, colorMap, MODE.COLOR_SHADE_ERROR);
  }

  async yen_source_to_target(src: number, tar: number, k: number): Promise<IgraphRawAlgorithmResult> {
    const g = this._ensureGraph();
    const weightAttr = this._getWeightAttr();
    const paths = yenKShortestPaths(g, src, tar, k, weightAttr);

    const colorMap: Record<string, number> = {};
    const pathsArray: { num: number; path: number[]; weight?: number }[] = [];

    paths.forEach((entry, index) => {
      const pathNodes = entry.path.map(nodeNum);
      pathNodes.forEach((node) => {
        colorMap[nodeId(node)] = 0.5;
      });
      for (let i = 1; i < pathNodes.length; i++) {
        colorMap[`${pathNodes[i - 1]}-${pathNodes[i]}`] = 1;
      }
      pathsArray.push({
        num: index + 1,
        path: pathNodes,
        ...(entry.weight !== undefined ? { weight: entry.weight } : {}),
      });
    });

    colorMap[nodeId(src)] = 1;
    colorMap[nodeId(tar)] = 1;

    const data: Record<string, unknown> = {
      algorithm: "Yen's k Shortest Paths",
      source: src,
      target: tar,
      k,
      weighted: this._hasWeights,
      paths: pathsArray,
    };
    return makeResult(data, colorMap, MODE.COLOR_SHADE_DEFAULT);
  }

  async bellman_ford_source_to_target(src: number, tar: number): Promise<IgraphRawAlgorithmResult> {
    const g = this._ensureGraph();
    const weightAttr = this._getWeightAttr();
    const directed = g.type === "directed";
    const { dist, prev } = bellmanFord(g, nodeId(src), directed, weightAttr);
    const nodePath = reconstructNodePath(dist, prev, nodeId(tar));
    const path = nodePath ? pathToLinks(nodePath, g, weightAttr) : [];

    const colorMap: Record<string, number> = {};
    for (const link of path) {
      colorMap[nodeId(link.from)] = 0.5;
      colorMap[nodeId(link.to)] = 0.5;
      colorMap[`${link.from}-${link.to}`] = 1;
    }
    colorMap[nodeId(src)] = 1;
    colorMap[nodeId(tar)] = 1;

    const data: Record<string, unknown> = {
      algorithm: "Bellman-Ford Single Path",
      source: src,
      target: tar,
      weighted: this._hasWeights,
      path,
    };
    if (this._hasWeights) {
      data.totalWeight = path.reduce((sum, link) => sum + (link.weight ?? 0), 0);
    }
    return makeResult(data, colorMap, MODE.COLOR_SHADE_DEFAULT);
  }

  async bellman_ford_source_to_all(src: number): Promise<IgraphRawAlgorithmResult> {
    const g = this._ensureGraph();
    const weightAttr = this._getWeightAttr();
    const directed = g.type === "directed";
    const { dist, prev } = bellmanFord(g, nodeId(src), directed, weightAttr);

    const colorMap: Record<string, number> = {};
    const pathsArray: { target: number; path: number[]; weight?: number }[] = [];
    const frequencies: Record<number, number> = {};

    for (const node of g.nodes()) {
      if (node === nodeId(src)) continue;
      const nodePath = reconstructNodePath(dist, prev, node);
      if (!nodePath || nodePath.length === 0) continue;

      const target = nodeNum(node);
      const pathNodes = nodePath.map(nodeNum);
      for (const pathNode of pathNodes) {
        if (pathNode !== src) {
          frequencies[pathNode] = (frequencies[pathNode] ?? 0) + 1;
        }
      }
      for (let i = 1; i < pathNodes.length; i++) {
        colorMap[`${pathNodes[i - 1]}-${pathNodes[i]}`] = 1;
      }

      const entry: { target: number; path: number[]; weight?: number } = {
        target,
        path: pathNodes,
      };
      if (weightAttr) {
        entry.weight = pathTotalWeight(nodePath, g, weightAttr);
      }
      pathsArray.push(entry);
    }

    frequenciesToColorMap(frequencies, colorMap);
    colorMap[nodeId(src)] = 1;

    const data: Record<string, unknown> = {
      algorithm: "Bellman-Ford Single Source",
      source: src,
      weighted: this._hasWeights,
      paths: pathsArray,
    };
    return makeResult(data, colorMap, MODE.COLOR_SHADE_ERROR);
  }

  async bfs(src: number): Promise<IgraphRawAlgorithmResult> {
    const g = this._ensureGraph();
    const srcStr = nodeId(src);
    const layers: { layer: number[]; index: number }[] = [];
    const visited = new Set<string>();
    const queue: { node: string; layer: number }[] = [{ node: srcStr, layer: 0 }];
    visited.add(srcStr);

    let maxLayer = 0;
    const byLayer: Map<number, number[]> = new Map();

    while (queue.length > 0) {
      const { node, layer } = queue.shift()!;
      maxLayer = Math.max(maxLayer, layer);
      if (!byLayer.has(layer)) byLayer.set(layer, []);
      byLayer.get(layer)!.push(nodeNum(node));

      for (const neighbor of g.neighbors(node)) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push({ node: neighbor, layer: layer + 1 });
        }
      }
    }

    for (let i = 0; i <= maxLayer; i++) {
      const layer = byLayer.get(i) ?? [];
      layers.push({ layer, index: i });
    }

    const freq: Record<number, number> = {};
    for (const arr of byLayer.values()) {
      for (const n of arr) freq[n] = (freq[n] ?? 0) + 1;
    }
    const maxFreq = Math.max(0, ...Object.values(freq));
    const colorMap: Record<string, number> = {};
    for (const [n, f] of Object.entries(freq)) {
      colorMap[nodeId(parseInt(n, 10))] = maxFreq > 0 ? f / maxFreq : 1;
    }
    colorMap[nodeId(src)] = 1;

    const data: Record<string, unknown> = {
      algorithm: "Breadth-First Search",
      source: src,
      nodesFound: visited.size,
      layers,
    };
    return makeResult(data, colorMap, MODE.COLOR_SHADE_ERROR);
  }

  async dfs(src: number): Promise<IgraphRawAlgorithmResult> {
    const g = this._ensureGraph();
    const srcStr = nodeId(src);
    const subtrees: { num: number; tree: number[] }[] = [];
    const visited = new Set<string>();

    // Iterative DFS to avoid stack overflow on large graphs
    const visitIter = (start: string, tree: number[]): void => {
      const stack: string[] = [start];
      while (stack.length > 0) {
        const node = stack.pop()!;
        if (visited.has(node)) continue;
        visited.add(node);
        tree.push(nodeNum(node));
        for (const n of g.neighbors(node)) {
          if (!visited.has(n)) stack.push(n);
        }
      }
    };

    const tree: number[] = [];
    visitIter(srcStr, tree);
    subtrees.push({ num: 0, tree });

    for (const n of g.nodes()) {
      if (!visited.has(n)) {
        const t: number[] = [];
        visitIter(n, t);
        subtrees.push({ num: subtrees.length, tree: t });
      }
    }

    const freq: Record<number, number> = {};
    for (const { tree: t } of subtrees) {
      for (const v of t) freq[v] = (freq[v] ?? 0) + 1;
    }
    const maxFreq = Math.max(0, ...Object.values(freq));
    const colorMap: Record<string, number> = {};
    for (const [n, f] of Object.entries(freq)) {
      colorMap[nodeId(parseInt(n, 10))] = maxFreq > 0 ? f / maxFreq : 1;
    }
    colorMap[nodeId(src)] = 1;

    const data: Record<string, unknown> = {
      algorithm: "Depth-First Search",
      source: src,
      nodesFound: visited.size,
      subtrees,
    };
    return makeResult(data, colorMap, MODE.COLOR_SHADE_ERROR);
  }

  async random_walk(start: number, steps: number): Promise<IgraphRawAlgorithmResult> {
    const g = this._ensureGraph();
    const weightAttr = this._getWeightAttr();
    const directed = g.type === "directed";
    const startStr = nodeId(start);

    const vertices: number[] = [start];
    const path: {
      step: number;
      from: number;
      to: number;
      weight?: number;
    }[] = [];
    const frequencies: Record<number, number> = { [start]: 1 };
    const colorMap: Record<string, number> = {};

    let current = startStr;
    for (let step = 1; step <= steps; step++) {
      const next = pickRandomNeighbor(g, current, directed, weightAttr);
      if (!next) break;

      const fromNum = nodeNum(current);
      const toNum = nodeNum(next);
      vertices.push(toNum);
      frequencies[toNum] = (frequencies[toNum] ?? 0) + 1;

      const link: { step: number; from: number; to: number; weight?: number } = {
        step,
        from: fromNum,
        to: toNum,
      };
      if (weightAttr && g.hasEdge(current, next)) {
        link.weight = g.getEdgeAttribute(current, next, WEIGHT_ATTR) as number;
      }
      path.push(link);
      colorMap[`${fromNum}-${toNum}`] = 1;
      current = next;
    }

    frequenciesToColorMap(frequencies, colorMap);

    let maxFrequency = 0;
    let maxFrequencyNode = start;
    for (const [node, freq] of Object.entries(frequencies)) {
      if (freq > maxFrequency) {
        maxFrequency = freq;
        maxFrequencyNode = parseInt(node, 10);
      }
    }

    const data: Record<string, unknown> = {
      algorithm: "Random Walk",
      source: start,
      steps,
      weighted: this._hasWeights,
      maxFrequencyNode,
      maxFrequency,
      path,
    };
    return makeResult(data, colorMap, MODE.COLOR_SHADE_DEFAULT);
  }

  async min_spanning_tree(): Promise<IgraphRawAlgorithmResult> {
    const g = this._ensureGraph();
    const weightAttr = this._getWeightAttr();
    const mstEdges = kruskalMst(g, weightAttr);

    const colorMap: Record<string, number> = {};
    const edgesArray: {
      num: number;
      from: number;
      to: number;
      weight?: number;
    }[] = [];
    let totalWeight = 0;

    mstEdges.forEach((edge, index) => {
      const from = nodeNum(edge.from);
      const to = nodeNum(edge.to);
      colorMap[nodeId(from)] = 0.5;
      colorMap[nodeId(to)] = 0.5;
      colorMap[`${from}-${to}`] = 1;

      const entry: { num: number; from: number; to: number; weight?: number } = {
        num: index + 1,
        from,
        to,
      };
      if (weightAttr) {
        entry.weight = edge.weight;
        totalWeight += edge.weight;
      }
      edgesArray.push(entry);
    });

    const data: Record<string, unknown> = {
      algorithm: "Minimum Spanning Tree",
      weighted: this._hasWeights,
      maxEdges: g.size,
      edges: edgesArray,
    };
    if (this._hasWeights) data.totalWeight = totalWeight;
    return makeResult(data, colorMap, MODE.COLOR_SHADE_ERROR);
  }

  async betweenness_centrality(): Promise<IgraphRawAlgorithmResult> {
    const g = this._ensureGraph();
    const weightAttr = this._getWeightAttr();
    const centralities = weightAttr
      ? betweennessCentrality(g, { getEdgeWeight: weightAttr })
      : betweennessCentrality(g);

    const colorMap: Record<string, number> = {};
    const sizeMap: Record<string, number> = {};
    const centralitiesList: { node: number; centrality: number }[] = [];
    const maxC = Math.max(0, ...Object.values(centralities));

    for (const [node, c] of Object.entries(centralities)) {
      const n = nodeNum(node);
      colorMap[nodeId(n)] = 1;
      sizeMap[nodeId(n)] = maxC > 0 ? c / maxC : 0;
      centralitiesList.push({ node: n, centrality: c });
    }

    const data: Record<string, unknown> = {
      algorithm: "Betweenness Centrality",
      centralities: centralitiesList,
    };
    return makeResult(data, colorMap, MODE.SIZE_SCALAR, sizeMap);
  }

  async closeness_centrality(): Promise<IgraphRawAlgorithmResult> {
    const g = this._ensureGraph();
    const centralities = closenessCentrality(g);

    const colorMap: Record<string, number> = {};
    const sizeMap: Record<string, number> = {};
    const centralitiesList: { node: number; centrality: number }[] = [];
    const maxC = Math.max(0, ...Object.values(centralities));

    for (const [node, c] of Object.entries(centralities)) {
      const n = nodeNum(node);
      colorMap[nodeId(n)] = 1;
      sizeMap[nodeId(n)] = maxC > 0 ? c / maxC : 0;
      centralitiesList.push({ node: n, centrality: c });
    }

    const data: Record<string, unknown> = {
      algorithm: "Closeness Centrality",
      centralities: centralitiesList,
    };
    return makeResult(data, colorMap, MODE.SIZE_SCALAR, sizeMap);
  }

  async degree_centrality(): Promise<IgraphRawAlgorithmResult> {
    const g = this._ensureGraph();
    const centralities = degreeCentrality(g);

    const colorMap: Record<string, number> = {};
    const sizeMap: Record<string, number> = {};
    const centralitiesList: { node: number; centrality: number }[] = [];
    const maxC = Math.max(0, ...Object.values(centralities));

    for (const [node, c] of Object.entries(centralities)) {
      const n = nodeNum(node);
      colorMap[nodeId(n)] = 1;
      sizeMap[nodeId(n)] = maxC > 0 ? c / maxC : 0;
      centralitiesList.push({ node: n, centrality: c });
    }

    const data: Record<string, unknown> = {
      algorithm: "Degree Centrality",
      centralities: centralitiesList,
    };
    return makeResult(data, colorMap, MODE.SIZE_SCALAR, sizeMap);
  }

  async eigenvector_centrality(): Promise<IgraphRawAlgorithmResult> {
    const g = this._ensureGraph();
    const weightAttr = this._getWeightAttr();
    const centralities = weightAttr
      ? eigenvectorCentrality(g, { getEdgeWeight: weightAttr })
      : eigenvectorCentrality(g);

    const colorMap: Record<string, number> = {};
    const sizeMap: Record<string, number> = {};
    const centralitiesList: { node: number; centrality: number }[] = [];
    const maxC = Math.max(0, ...Object.values(centralities));

    for (const [node, c] of Object.entries(centralities)) {
      const n = nodeNum(node);
      colorMap[nodeId(n)] = 1;
      sizeMap[nodeId(n)] = maxC > 0 ? c / maxC : 0;
      centralitiesList.push({ node: n, centrality: c });
    }

    const data: Record<string, unknown> = {
      algorithm: "Eigenvector Centrality",
      centralities: centralitiesList,
    };
    return makeResult(data, colorMap, MODE.SIZE_SCALAR, sizeMap);
  }

  async strength_centrality(): Promise<IgraphRawAlgorithmResult> {
    const g = this._ensureGraph();
    if (!this._hasWeights) {
      return this.degree_centrality();
    }
    const centralities: Record<string, number> = {};
    for (const node of g.nodes()) {
      centralities[node] = weightedDegree(g, node, WEIGHT_ATTR);
    }

    const colorMap: Record<string, number> = {};
    const sizeMap: Record<string, number> = {};
    const centralitiesList: { node: number; centrality: number }[] = [];
    const maxC = Math.max(0, ...Object.values(centralities));

    for (const [node, c] of Object.entries(centralities)) {
      const n = nodeNum(node);
      colorMap[nodeId(n)] = 1;
      sizeMap[nodeId(n)] = maxC > 0 ? c / maxC : 0;
      centralitiesList.push({ node: n, centrality: c });
    }

    const data: Record<string, unknown> = {
      algorithm: "Strength Centrality",
      centralities: centralitiesList,
    };
    return makeResult(data, colorMap, MODE.SIZE_SCALAR, sizeMap);
  }

  async harmonic_centrality(): Promise<IgraphRawAlgorithmResult> {
    const g = this._ensureGraph();
    const weightAttr = this._getWeightAttr();

    const scores: { node: number; centrality: number }[] = [];
    for (const src of g.nodes()) {
      let harmonic = 0;

      if (weightAttr) {
        const paths = dijkstra.singleSource(g, src, weightAttr);
        for (const [target, nodePath] of Object.entries(paths)) {
          if (!nodePath || nodePath.length <= 1 || target === src) continue;
          let distance = 0;
          for (let i = 1; i < nodePath.length; i++) {
            distance += g.getEdgeAttribute(nodePath[i - 1], nodePath[i], WEIGHT_ATTR) ?? 0;
          }
          if (distance > 0) harmonic += 1 / distance;
        }
      } else {
        const lengths = singleSourceLength(g, src);
        for (const [target, length] of Object.entries(lengths)) {
          if (target === src || length <= 0 || !Number.isFinite(length)) continue;
          harmonic += 1 / length;
        }
      }

      scores.push({ node: nodeNum(src), centrality: harmonic });
    }

    const maxC = Math.max(0, ...scores.map((entry) => entry.centrality));
    const colorMap: Record<string, number> = {};
    const sizeMap: Record<string, number> = {};
    const centralitiesList: { node: number; centrality: number }[] = [];

    for (const { node, centrality } of scores) {
      colorMap[nodeId(node)] = 1;
      sizeMap[nodeId(node)] = maxC > 0 ? centrality / maxC : 0;
      centralitiesList.push({ node, centrality: round4(centrality) });
    }

    const data: Record<string, unknown> = {
      algorithm: "Harmonic Centrality",
      centralities: centralitiesList,
    };
    return makeResult(data, colorMap, MODE.SIZE_SCALAR, sizeMap);
  }

  async pagerank(damping: number): Promise<IgraphRawAlgorithmResult> {
    const g = this._ensureGraph();
    const weightAttr = this._getWeightAttr();
    const centralities = weightAttr
      ? pagerank(g, { alpha: damping, getEdgeWeight: weightAttr })
      : pagerank(g, { alpha: damping, getEdgeWeight: null });

    const colorMap: Record<string, number> = {};
    const sizeMap: Record<string, number> = {};
    const centralitiesList: { node: number; centrality: number }[] = [];
    const maxC = Math.max(0, ...Object.values(centralities));

    for (const [node, c] of Object.entries(centralities)) {
      const n = nodeNum(node);
      colorMap[nodeId(n)] = 1;
      sizeMap[nodeId(n)] = maxC > 0 ? c / maxC : 0;
      centralitiesList.push({ node: n, centrality: c });
    }

    const data: Record<string, unknown> = {
      algorithm: "PageRank",
      centralities: centralitiesList,
    };
    return makeResult(data, colorMap, MODE.SIZE_SCALAR, sizeMap);
  }

  async louvain(resolution: number): Promise<IgraphRawAlgorithmResult> {
    const g = this._ensureGraph();
    requireUndirected(g, "Louvain");
    const weightAttr = this._getWeightAttr();
    const assignments = weightAttr
      ? louvain(g, { resolution, getEdgeWeight: weightAttr })
      : louvain(g, { resolution });

    const labels = new Map<string, number>();
    for (const [node, community] of Object.entries(assignments)) {
      labels.set(node, community);
    }
    const { colorMap, communities } = communitiesFromLabels(labels);
    const modularityScore = round2(
      modularity(g, {
        getNodeCommunity: (node) => labels.get(node)!,
        getEdgeWeight: weightAttr ?? null,
        resolution,
      })
    );

    const data: Record<string, unknown> = {
      algorithm: "Louvain Community Detection",
      modularity: modularityScore,
      communities,
    };
    return makeResult(data, colorMap, MODE.RAINBOW);
  }

  async leiden(resolution: number): Promise<IgraphRawAlgorithmResult> {
    const g = this._ensureGraph();
    requireUndirected(g, "Leiden Community Detection");
    const weightAttr = this._getWeightAttr();

    const details = leiden.detailed(g, {
      resolution,
      weighted: !!weightAttr,
      attributes: weightAttr ? { weight: weightAttr } : undefined,
    });

    const labels = new Map<string, number>();
    for (const [node, community] of Object.entries(details.communities)) {
      labels.set(node, community);
    }
    const { colorMap, communities } = communitiesFromLabels(labels);
    const modularityScore = round2(details.modularity);

    const data: Record<string, unknown> = {
      modularity: modularityScore,
      quality: modularityScore,
      communities,
    };
    return makeResult(data, colorMap, MODE.RAINBOW);
  }

  async fast_greedy(): Promise<IgraphRawAlgorithmResult> {
    const g = this._ensureGraph();
    requireUndirected(g, "Fast-Greedy Community Detection");
    const weightAttr = this._getWeightAttr();
    const { labels, modularityScore } = fastGreedyCommunities(g, weightAttr);
    const { colorMap, communities } = communitiesFromLabels(labels);

    const data: Record<string, unknown> = {
      algorithm: "Fast-Greedy Community Detection",
      modularity: round2(modularityScore),
      communities,
    };
    return makeResult(data, colorMap, MODE.RAINBOW);
  }

  async label_propagation(): Promise<IgraphRawAlgorithmResult> {
    const g = this._ensureGraph();
    const weightAttr = this._getWeightAttr();
    const directed = g.type === "directed";

    const labels = new Map<string, number>();
    for (const node of g.nodes()) {
      labels.set(node, nodeNum(node));
    }

    let changed = true;
    let iterations = 0;
    const maxIterations = Math.max(1, g.order * 10);

    while (changed && iterations < maxIterations) {
      changed = false;
      iterations += 1;

      const nodes = [...g.nodes()].sort(() => Math.random() - 0.5);
      for (const node of nodes) {
        const votes = new Map<number, number>();
        const neighbors = directed ? g.outboundNeighbors(node) : g.neighbors(node);

        for (const neighbor of neighbors) {
          const label = labels.get(neighbor)!;
          const vote = weightAttr
            ? (g.getEdgeAttribute(node, neighbor, WEIGHT_ATTR) ?? 1)
            : 1;
          votes.set(label, (votes.get(label) ?? 0) + vote);
        }

        if (votes.size === 0) continue;

        let bestLabel = labels.get(node)!;
        let bestScore = -1;
        for (const [label, score] of votes) {
          if (score > bestScore || (score === bestScore && label < bestLabel)) {
            bestScore = score;
            bestLabel = label;
          }
        }

        if (bestLabel !== labels.get(node)) {
          labels.set(node, bestLabel);
          changed = true;
        }
      }
    }

    const communityMap = new Map<number, number[]>();
    const colorMap: Record<string, number> = {};
    for (const [node, label] of labels) {
      const numericNode = nodeNum(node);
      colorMap[nodeId(numericNode)] = label;
      if (!communityMap.has(label)) communityMap.set(label, []);
      communityMap.get(label)!.push(numericNode);
    }

    const communities = [...communityMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, members]) => members);

    const data: Record<string, unknown> = {
      algorithm: "Label Propagation",
      communities,
    };
    return makeResult(data, colorMap, MODE.RAINBOW);
  }

  async local_clustering_coefficient(): Promise<IgraphRawAlgorithmResult> {
    const g = this._ensureGraph();
    const analysisGraph = g.type !== "undirected" ? toUndirected(g) : g;

    const coefficients: { node: number; value: number }[] = [];
    const valueMap: Record<number, number> = {};
    const positiveValues: number[] = [];

    for (const node of analysisGraph.nodes()) {
      const value = round4(localClusteringForNode(analysisGraph, node));
      const numericNode = nodeNum(node);
      coefficients.push({ node: numericNode, value });
      valueMap[numericNode] = value;
      if (value > 0) positiveValues.push(value);
    }

    const globalCoefficient = round4(
      positiveValues.length > 0
        ? positiveValues.reduce((sum, value) => sum + value, 0) / positiveValues.length
        : 0
    );

    const colorMap: Record<string, number> = {};
    doublesToColorMap(valueMap, colorMap);

    const data: Record<string, unknown> = {
      algorithm: "Local Clustering Coefficient",
      global_coefficient: globalCoefficient,
      coefficients,
    };
    return makeResult(data, colorMap, MODE.COLOR_SHADE_DEFAULT);
  }

  async k_core(k: number): Promise<IgraphRawAlgorithmResult> {
    const g = this._ensureGraph();
    // graphology-cores exports coreNumber with assign=false pre-bound
    const coreness = (
      coreNumber as unknown as (graph: Graph) => Record<string, number>
    )(g);

    let maxCoreness = 0;
    const cores: number[] = [];
    const coreNodes = new Set<string>();

    for (const [node, value] of Object.entries(coreness)) {
      maxCoreness = Math.max(maxCoreness, value);
      if (value >= k) {
        const numericNode = nodeNum(node);
        cores.push(numericNode);
        coreNodes.add(node);
      }
    }

    const colorMap: Record<string, number> = {};
    g.forEachEdge((_, __, source, target) => {
      if (!coreNodes.has(source) || !coreNodes.has(target)) return;
      const from = nodeNum(source);
      const to = nodeNum(target);
      colorMap[`${from}-${to}`] = 1;
      colorMap[nodeId(from)] = 0.5;
      colorMap[nodeId(to)] = 0.5;
    });

    const data: Record<string, unknown> = {
      algorithm: "K-Core Detection",
      k,
      max_coreness: maxCoreness,
      cores,
    };
    return makeResult(data, colorMap, MODE.COLOR_SHADE_DEFAULT);
  }

  async triangle_count(): Promise<IgraphRawAlgorithmResult> {
    const g = this._ensureGraph();
    const analysisGraph = g.type !== "undirected" ? toUndirected(g) : g;

    const triangles: {
      id: number;
      node1: number;
      node2: number;
      node3: number;
    }[] = [];
    const seen = new Set<string>();
    const colorMap: Record<string, number> = {};
    let triangleId = 1;

    for (const node of analysisGraph.nodes()) {
      const anchor = nodeNum(node);
      const neighbors = [...analysisGraph.neighbors(node)]
        .map(nodeNum)
        .sort((a, b) => a - b);

      for (let i = 0; i < neighbors.length; i++) {
        for (let j = i + 1; j < neighbors.length; j++) {
          const n2 = neighbors[i];
          const n3 = neighbors[j];
          if (!neighborsAreConnected(analysisGraph, nodeId(n2), nodeId(n3))) continue;

          const key = [anchor, n2, n3].sort((a, b) => a - b).join(",");
          if (seen.has(key)) continue;
          seen.add(key);

          triangles.push({
            id: triangleId++,
            node1: anchor,
            node2: n2,
            node3: n3,
          });

          colorMap[nodeId(anchor)] = 0.5;
          colorMap[nodeId(n2)] = 0.5;
          colorMap[nodeId(n3)] = 0.5;
          colorMap[`${anchor}-${n2}`] = 1;
          colorMap[`${n2}-${n3}`] = 1;
          colorMap[`${n3}-${anchor}`] = 1;
        }
      }
    }

    const data: Record<string, unknown> = {
      algorithm: "Triangle Count",
      triangles,
    };
    return makeResult(data, colorMap, MODE.COLOR_SHADE_DEFAULT);
  }

  async strongly_connected_components(): Promise<IgraphRawAlgorithmResult> {
    const g = this._ensureGraph();
    if (g.type !== "directed") {
      return this.weakly_connected_components();
    }
    const components = stronglyConnectedComponents(g);

    const colorMap: Record<string, number> = {};
    const componentsList: number[][] = [];
    let idx = 0;
    for (const comp of components) {
      const arr = comp.map((n) => nodeNum(n));
      componentsList.push(arr);
      for (const n of arr) {
        colorMap[nodeId(n)] = idx;
      }
      idx++;
    }

    const data: Record<string, unknown> = {
      algorithm: "Strongly Connected Components",
      components: componentsList,
    };
    return makeResult(data, colorMap, MODE.RAINBOW);
  }

  async weakly_connected_components(): Promise<IgraphRawAlgorithmResult> {
    const g = this._ensureGraph();
    const undirected = g.type !== "undirected" ? toUndirected(g) : g;
    const components = connectedComponents(undirected);

    const colorMap: Record<string, number> = {};
    const componentsList: number[][] = [];
    let idx = 0;
    for (const comp of components) {
      const arr = comp.map((n) => nodeNum(n));
      componentsList.push(arr);
      for (const n of arr) {
        colorMap[nodeId(n)] = idx;
      }
      idx++;
    }

    const data: Record<string, unknown> = {
      algorithm: "Weakly Connected Components",
      components: componentsList,
    };
    return makeResult(data, colorMap, MODE.RAINBOW);
  }

  async vertices_are_adjacent(src: number, tar: number): Promise<IgraphRawAlgorithmResult> {
    const g = this._ensureGraph();
    const srcStr = nodeId(src);
    const tarStr = nodeId(tar);
    const res = g.hasEdge(srcStr, tarStr);

    const colorMap: Record<string, number> = {};
    colorMap[nodeId(src)] = 1;
    colorMap[nodeId(tar)] = 1;

    const data: Record<string, unknown> = {
      algorithm: "Check Adjacency",
      source: src,
      target: tar,
      adjacent: res,
    };

    if (res && g.hasEdge(srcStr, tarStr)) {
      const linkId = `${src}-${tar}`;
      colorMap[linkId] = 1;
      const w = g.getEdgeAttribute(srcStr, tarStr, WEIGHT_ATTR);
      if (w !== undefined) data.weight = w;
    }

    return makeResult(data, colorMap, MODE.COLOR_SHADE_DEFAULT);
  }

  async jaccard_similarity(jsVsList: unknown): Promise<IgraphRawAlgorithmResult> {
    const g = this._ensureGraph();
    const vs = Array.isArray(jsVsList) ? jsVsList : [];
    const nodes = vs.map((v: unknown) => (typeof v === "number" ? nodeId(v) : String(v)));

    const getNeighbors = (n: string): Set<string> => {
      const s = new Set<string>();
      for (const neighbor of g.neighbors(n)) s.add(neighbor);
      return s;
    };

    const rows: { node1: number; node2: number; similarity: number }[] = [];
    let maxSim = 0;
    const colorMap: Record<string, number> = {};

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const n1 = nodes[i];
        const n2 = nodes[j];
        const set1 = getNeighbors(n1);
        const set2 = getNeighbors(n2);
        const inter = [...set1].filter((x) => set2.has(x)).length;
        const union = new Set([...set1, ...set2]).size;
        const sim = union > 0 ? inter / union : 0;
        rows.push({
          node1: nodeNum(n1),
          node2: nodeNum(n2),
          similarity: sim,
        });
        maxSim = Math.max(maxSim, sim);
        colorMap[nodeId(nodeNum(n1))] = 1;
        colorMap[nodeId(nodeNum(n2))] = 1;
      }
    }

    const nodeNums = nodes.map((n) => nodeNum(n));
    const maxPair =
      rows.length > 0
        ? rows.reduce((a, b) => (a.similarity >= b.similarity ? a : b))
        : { node1: nodeNums[0] ?? 0, node2: nodeNums[1] ?? 0, similarity: 0 };

    // Build full NxN matrix (same format as WASM) for UI compatibility
    const n = nodeNums.length;
    const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) matrix[i][i] = 1;
    const pairToSim = new Map<string, number>();
    for (const row of rows) {
      const key = `${Math.min(row.node1, row.node2)}_${Math.max(row.node1, row.node2)}`;
      pairToSim.set(key, row.similarity);
    }
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const key = `${Math.min(nodeNums[i], nodeNums[j])}_${Math.max(nodeNums[i], nodeNums[j])}`;
        const sim = pairToSim.get(key) ?? 0;
        matrix[i][j] = matrix[j][i] = sim;
      }
    }

    const data: Record<string, unknown> = {
      algorithm: "Jaccard Similarity",
      similarityMatrix: matrix,
      maxSimilarity: maxPair,
      nodes: nodeNums,
    };
    return makeResult(data, colorMap, MODE.COLOR_SHADE_DEFAULT);
  }

  async topological_sort(): Promise<IgraphRawAlgorithmResult> {
    const g = this._ensureGraph();
    const order = topologicalSort(g);
    const nodeOrder = order.map((n) => nodeNum(n));

    const colorMap: Record<string, number> = {};
    const maxIdx = nodeOrder.length - 1;
    for (let i = 0; i < nodeOrder.length; i++) {
      colorMap[nodeId(nodeOrder[i])] = maxIdx > 0 ? i / maxIdx : 1;
    }

    const data: Record<string, unknown> = {
      algorithm: "Topological Sort",
      order: nodeOrder,
    };
    return makeResult(data, colorMap, MODE.COLOR_SHADE_DEFAULT);
  }

  async diameter(): Promise<IgraphRawAlgorithmResult> {
    const g = this._ensureGraph();
    const weightAttr = this._getWeightAttr();

    // igraph_diameter_dijkstra: diameter = max eccentricity over all vertices
    // Eccentricity(v) = max shortest path distance from v to any reachable vertex
    let diameter = 0;
    let bestSrc: string | null = null;
    let bestTar: string | null = null;

    for (const src of g.nodes()) {
      let maxDist = 0;
      let farthest: string | null = null;

      if (weightAttr) {
        const paths = dijkstra.singleSource(g, src, weightAttr);
        for (const [target, path] of Object.entries(paths)) {
          if (!path || path.length <= 1) continue;
          let dist = 0;
          for (let i = 1; i < path.length; i++) {
            dist += g.getEdgeAttribute(path[i - 1], path[i], WEIGHT_ATTR) ?? 0;
          }
          if (dist > maxDist) {
            maxDist = dist;
            farthest = target;
          }
        }
      } else {
        const lengths = singleSourceLength(g, src);
        for (const [target, len] of Object.entries(lengths)) {
          if (len > maxDist) {
            maxDist = len;
            farthest = target;
          }
        }
      }

      if (maxDist > diameter && farthest) {
        diameter = maxDist;
        bestSrc = src;
        bestTar = farthest;
      }
    }

    const colorMap: Record<string, number> = {};
    const path: { from: number; to: number; weight?: number }[] = [];
    let srcNum = 0;
    let tarNum = 0;

    if (bestSrc && bestTar && diameter > 0) {
      const p = weightAttr
        ? dijkstra.bidirectional(g, bestSrc, bestTar, weightAttr)
        : unweightedBidirectional(g, bestSrc, bestTar);

      if (p && p.length > 1) {
        srcNum = nodeNum(bestSrc);
        tarNum = nodeNum(bestTar);
        for (let i = 1; i < p.length; i++) {
          const from = nodeNum(p[i - 1]);
          const to = nodeNum(p[i]);
          colorMap[nodeId(from)] = 0.5;
          colorMap[nodeId(to)] = 0.5;
          colorMap[`${from}-${to}`] = 1;
          const w = weightAttr
            ? (g.getEdgeAttribute(p[i - 1], p[i], WEIGHT_ATTR) as number | undefined)
            : undefined;
          path.push({ from, to, weight: w });
        }
        colorMap[nodeId(srcNum)] = 1;
        colorMap[nodeId(tarNum)] = 1;
      }
    }

    const data: Record<string, unknown> = {
      algorithm: "Diameter",
      source: srcNum,
      target: tarNum,
      weighted: this._hasWeights,
      diameter,
      path,
    };
    return makeResult(data, colorMap, MODE.COLOR_SHADE_DEFAULT);
  }

  async eulerian_path(): Promise<IgraphRawAlgorithmResult> {
    const g = this._ensureGraph();
    const directed = g.type === "directed";
    const { hasPath } = eulerianStatus(g);
    const colorMap: Record<string, number> = {};

    if (!hasPath) {
      const data: Record<string, unknown> = {
        algorithm: "Eulerian Path",
        hasPath: false,
        message: "This graph does not have an Eulerian path.",
        start: "N/A",
        end: "N/A",
        path: [],
      };
      return makeResult(data, colorMap, MODE.COLOR_SHADE_DEFAULT);
    }

    if (g.size === 0) {
      const data: Record<string, unknown> = {
        algorithm: "Eulerian Path",
        hasPath: true,
        message: "Graph has no edges; Eulerian path is empty.",
        start: "N/A",
        end: "N/A",
        path: [],
      };
      return makeResult(data, colorMap, MODE.COLOR_SHADE_DEFAULT);
    }

    const start = eulerianStartNode(g, false);
    const tour = hierholzerTour(buildAdjacencyLists(g, directed), start!, directed);
    const path = [];
    for (let i = 0; i < tour.length - 1; i++) {
      const from = nodeNum(tour[i]);
      const to = nodeNum(tour[i + 1]);
      colorMap[`${from}-${to}`] = 1;
      path.push({ from, to });
    }
    colorMap[nodeId(nodeNum(tour[0]))] = 1;
    colorMap[nodeId(nodeNum(tour[tour.length - 1]))] = 1;

    const data: Record<string, unknown> = {
      algorithm: "Eulerian Path",
      hasPath: true,
      start: nodeNum(tour[0]),
      end: nodeNum(tour[tour.length - 1]),
      path,
    };
    return makeResult(data, colorMap, MODE.COLOR_SHADE_DEFAULT);
  }

  async eulerian_circuit(): Promise<IgraphRawAlgorithmResult> {
    const g = this._ensureGraph();
    const directed = g.type === "directed";
    const { hasPath, hasCircuit } = eulerianStatus(g);
    const colorMap: Record<string, number> = {};

    if (!hasCircuit) {
      const data: Record<string, unknown> = {
        algorithm: "Eulerian Circuit",
        hasCircuit: false,
        message: hasPath
          ? "This graph has an Eulerian path but does not have an Eulerian circuit."
          : "This graph does not have an Eulerian circuit.",
        path: [],
      };
      return makeResult(data, colorMap, MODE.COLOR_SHADE_DEFAULT);
    }

    if (g.size === 0) {
      const data: Record<string, unknown> = {
        algorithm: "Eulerian Circuit",
        hasCircuit: true,
        message: "Graph has no edges; Eulerian circuit is empty.",
        path: [],
      };
      return makeResult(data, colorMap, MODE.COLOR_SHADE_DEFAULT);
    }

    const start = eulerianStartNode(g, true);
    const tour = hierholzerTour(buildAdjacencyLists(g, directed), start!, directed);
    const path = [];
    for (let i = 0; i < tour.length - 1; i++) {
      const from = nodeNum(tour[i]);
      const to = nodeNum(tour[i + 1]);
      colorMap[`${from}-${to}`] = 1;
      path.push({ from, to });
    }

    const data: Record<string, unknown> = {
      algorithm: "Eulerian Circuit",
      hasCircuit: true,
      path,
    };
    return makeResult(data, colorMap, MODE.COLOR_SHADE_DEFAULT);
  }

  async missing_edge_prediction_default_values(): Promise<IgraphRawAlgorithmResult> {
    return Promise.resolve({
      data: { numBins: 50, sampleSize: 1000 },
      colorMap: {},
      mode: MODE.COLOR_SHADE_DEFAULT,
    });
  }

  async missing_edge_prediction(_src: number, _tar: number): Promise<IgraphRawAlgorithmResult> {
    notImplemented("Missing Edge Prediction (HRG)");
  }
}
