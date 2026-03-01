import type { GraphNode } from "~/features/visualizer/types";

/**
 * Interface for graph algorithm module. Implemented by both WASM (igraph) and
 * Graphology adapter (pure JS version). All algorithm methods return result
 * objects with { data, colorMap, mode, sizeMap? }.
 */
export interface IGraphModule {
  cleanupGraph(): void | Promise<void>;
  create_graph_from_kuzu_to_igraph(
    nodes: number,
    src: Int32Array,
    dst: Int32Array,
    directed: boolean,
    weight?: Float64Array | Float32Array
  ): void | Promise<void>;
  dijkstra_source_to_target(src: number, tar: number): Promise<Record<string, unknown>>;
  dijkstra_source_to_all(src: number): Promise<Record<string, unknown>>;
  yen_source_to_target(src: number, tar: number, k: number): Promise<Record<string, unknown>>;
  bellman_ford_source_to_target(src: number, tar: number): Promise<Record<string, unknown>>;
  bellman_ford_source_to_all(src: number): Promise<Record<string, unknown>>;
  bfs(src: number): Promise<Record<string, unknown>>;
  dfs(src: number): Promise<Record<string, unknown>>;
  random_walk(start: number, steps: number): Promise<Record<string, unknown>>;
  min_spanning_tree(): Promise<Record<string, unknown>>;
  betweenness_centrality(): Promise<Record<string, unknown>>;
  closeness_centrality(): Promise<Record<string, unknown>>;
  degree_centrality(): Promise<Record<string, unknown>>;
  eigenvector_centrality(): Promise<Record<string, unknown>>;
  strength_centrality(): Promise<Record<string, unknown>>;
  harmonic_centrality(): Promise<Record<string, unknown>>;
  pagerank(damping: number): Promise<Record<string, unknown>>;
  louvain(resolution: number): Promise<Record<string, unknown>>;
  leiden(resolution: number): Promise<Record<string, unknown>>;
  fast_greedy(): Promise<Record<string, unknown>>;
  label_propagation(): Promise<Record<string, unknown>>;
  local_clustering_coefficient(): Promise<Record<string, unknown>>;
  k_core(k: number): Promise<Record<string, unknown>>;
  triangle_count(): Promise<Record<string, unknown>>;
  strongly_connected_components(): Promise<Record<string, unknown>>;
  weakly_connected_components(): Promise<Record<string, unknown>>;
  vertices_are_adjacent(src: number, tar: number): Promise<Record<string, unknown>>;
  jaccard_similarity(jsVsList: unknown): Promise<Record<string, unknown>>;
  topological_sort(): Promise<Record<string, unknown>>;
  diameter(): Promise<Record<string, unknown>>;
  eulerian_path(): Promise<Record<string, unknown>>;
  eulerian_circuit(): Promise<Record<string, unknown>>;
  missing_edge_prediction_default_values(): Promise<Record<string, unknown>>;
  missing_edge_prediction(src: number, tar: number): Promise<Record<string, unknown>>;
  what_to_stderr(ptr: number): string;
}

export type IgraphInput = {
  nodes: number; // nodes number
  src: Int32Array; // length = E
  dst: Int32Array; // length = E
  directed: boolean; // true = directed
  weight?: Float64Array | Float32Array; // optional, length = E
};

export type KuzuToIgraphParseResult = {
  IgraphInput: IgraphInput;
  KuzuToIgraphMap: Map<string, number>; // Map Kuzu ID to Igraph ID
  IgraphToKuzuMap: Map<number, string>; // Map back Igraph ID to Kuzu ID
  nodesMap: Map<string, GraphNode>; // Map back kuzu id to nodes
};

type NodeId = string;
type EdgeId = string; // Format: "fromNodeId-toNodeId"
type ColorValue = number; // 0.5 for partial highlight, 1 for full highlight, or frequency-based values

export type ColorMap = {
  [key: NodeId | EdgeId]: ColorValue;
};

export type SizeMap = {
  [key: NodeId]: number;
};

export type BaseGraphAlgorithmResult = {
  colorMap: ColorMap;
  sizeMap?: SizeMap;
  mode: number;
};

export const MODE = {
  COLOR_IMPORTANT: 1,
  COLOR_SHADE_DEFAULT: 2,
  COLOR_SHADE_ERROR: 3,
  SIZE_SCALAR: 4,
  RAINBOW: 5,
} as const;

export type GraphModule = IGraphModule;
