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
import louvain from "graphology-communities-louvain";
import {
  connectedComponents,
  stronglyConnectedComponents,
} from "graphology-components";
import { toUndirected } from "graphology-operators";
import { kCore } from "graphology-cores";
import { topologicalSort } from "graphology-dag";
import betweennessCentrality from "graphology-metrics/centrality/betweenness";
import closenessCentrality from "graphology-metrics/centrality/closeness";
import degreeCentrality from "graphology-metrics/centrality/degree";
import eigenvectorCentrality from "graphology-metrics/centrality/eigenvector";
import pagerank from "graphology-metrics/centrality/pagerank";
import {
  weightedDegree,
} from "graphology-metrics/node/weighted-degree";
import type { IGraphModule } from "./igraph/types";
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
    `[NovaGraph JS] Algorithm "${name}" is not implemented in the Graphology adapter. ` +
      `Use the WASM build for this algorithm.`
  );
}

function makeResult(
  data: Record<string, unknown>,
  colorMap: Record<string, number>,
  mode: number,
  sizeMap?: Record<string, number>
): Record<string, unknown> {
  const result: Record<string, unknown> = { data, colorMap, mode };
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

  async dijkstra_source_to_target(src: number, tar: number): Promise<Record<string, unknown>> {
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
          totalWeight += w;
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

  async dijkstra_source_to_all(src: number): Promise<Record<string, unknown>> {
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
          totalWeight += w;
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

  async yen_source_to_target(_src: number, _tar: number, _k: number): Promise<Record<string, unknown>> {
    notImplemented("Yen's k Shortest Paths");
  }

  async bellman_ford_source_to_target(_src: number, _tar: number): Promise<Record<string, unknown>> {
    notImplemented("Bellman-Ford Single Path");
  }

  async bellman_ford_source_to_all(_src: number): Promise<Record<string, unknown>> {
    notImplemented("Bellman-Ford Single Source");
  }

  async bfs(src: number): Promise<Record<string, unknown>> {
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

  async dfs(src: number): Promise<Record<string, unknown>> {
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

  async random_walk(_start: number, _steps: number): Promise<Record<string, unknown>> {
    notImplemented("Random Walk");
  }

  async min_spanning_tree(): Promise<Record<string, unknown>> {
    notImplemented("Minimum Spanning Tree");
  }

  async betweenness_centrality(): Promise<Record<string, unknown>> {
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

  async closeness_centrality(): Promise<Record<string, unknown>> {
    const g = this._ensureGraph();
    const weightAttr = this._getWeightAttr();
    const centralities = weightAttr
      ? closenessCentrality(g, { getEdgeWeight: weightAttr })
      : closenessCentrality(g);

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

  async degree_centrality(): Promise<Record<string, unknown>> {
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

  async eigenvector_centrality(): Promise<Record<string, unknown>> {
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

  async strength_centrality(): Promise<Record<string, unknown>> {
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

  async harmonic_centrality(): Promise<Record<string, unknown>> {
    notImplemented("Harmonic Centrality");
  }

  async pagerank(damping: number): Promise<Record<string, unknown>> {
    const g = this._ensureGraph();
    const weightAttr = this._getWeightAttr();
    const centralities = weightAttr
      ? pagerank(g, { alpha: damping, getEdgeWeight: weightAttr })
      : pagerank(g, { alpha: damping });

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

  async louvain(resolution: number): Promise<Record<string, unknown>> {
    const g = this._ensureGraph();
    const weightAttr = this._getWeightAttr();
    const communities = weightAttr
      ? louvain(g, { resolution, getEdgeWeight: weightAttr })
      : louvain(g, { resolution });

    const colorMap: Record<string, number> = {};
    const components: number[][] = [];
    const byComm: Map<number, number[]> = new Map();

    for (const [node, c] of Object.entries(communities)) {
      const n = nodeNum(node);
      colorMap[nodeId(n)] = c;
      if (!byComm.has(c)) byComm.set(c, []);
      byComm.get(c)!.push(n);
    }

    for (const [, arr] of byComm) {
      components.push(arr);
    }

    const data: Record<string, unknown> = {
      algorithm: "Louvain Community Detection",
      components,
    };
    return makeResult(data, colorMap, MODE.RAINBOW);
  }

  async leiden(_resolution: number): Promise<Record<string, unknown>> {
    notImplemented("Leiden Community Detection");
  }

  async fast_greedy(): Promise<Record<string, unknown>> {
    notImplemented("Fast Greedy");
  }

  async label_propagation(): Promise<Record<string, unknown>> {
    notImplemented("Label Propagation");
  }

  async local_clustering_coefficient(): Promise<Record<string, unknown>> {
    notImplemented("Local Clustering Coefficient");
  }

  async k_core(k: number): Promise<Record<string, unknown>> {
    const g = this._ensureGraph();
    const coreGraph = kCore(g, k);

    const colorMap: Record<string, number> = {};
    const components: number[][] = [];

    if (coreGraph.order > 0) {
      const comps = connectedComponents(coreGraph);
      let idx = 0;
      for (const comp of comps) {
        const arr = comp.map((n) => nodeNum(n));
        components.push(arr);
        for (const n of arr) {
          colorMap[nodeId(n)] = idx;
        }
        idx++;
      }
    }

    const data: Record<string, unknown> = {
      algorithm: "K-Core",
      k,
      components,
    };
    return makeResult(data, colorMap, MODE.RAINBOW);
  }

  async triangle_count(): Promise<Record<string, unknown>> {
    notImplemented("Triangle Count");
  }

  async strongly_connected_components(): Promise<Record<string, unknown>> {
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

  async weakly_connected_components(): Promise<Record<string, unknown>> {
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

  async vertices_are_adjacent(src: number, tar: number): Promise<Record<string, unknown>> {
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

  async jaccard_similarity(jsVsList: unknown): Promise<Record<string, unknown>> {
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

  async topological_sort(): Promise<Record<string, unknown>> {
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

  async diameter(): Promise<Record<string, unknown>> {
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

  async eulerian_path(): Promise<Record<string, unknown>> {
    notImplemented("Eulerian Path");
  }

  async eulerian_circuit(): Promise<Record<string, unknown>> {
    notImplemented("Eulerian Circuit");
  }

  async missing_edge_prediction_default_values(): Promise<Record<string, unknown>> {
    return Promise.resolve({
      data: { numBins: 50, sampleSize: 1000 },
      colorMap: {},
      mode: MODE.COLOR_SHADE_DEFAULT,
    });
  }

  async missing_edge_prediction(_src: number, _tar: number): Promise<Record<string, unknown>> {
    notImplemented("Missing Edge Prediction (HRG)");
  }
}
