import type { GraphNode } from "~/features/visualizer/types";

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

/** Raw algorithm payload from the graph module before Kuzu ID remapping. */
export type IgraphRawAlgorithmResult = BaseGraphAlgorithmResult & {
  data: Record<string, unknown>;
};

/**
 * Interface for graph algorithm module. Implemented by the Graphology adapter
 * (pure JS version). All algorithm methods return result objects with
 * { data, colorMap, mode, sizeMap? }.
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
  dijkstra_source_to_target(src: number, tar: number): Promise<IgraphRawAlgorithmResult>;
  dijkstra_source_to_all(src: number): Promise<IgraphRawAlgorithmResult>;
  yen_source_to_target(src: number, tar: number, k: number): Promise<IgraphRawAlgorithmResult>;
  bellman_ford_source_to_target(src: number, tar: number): Promise<IgraphRawAlgorithmResult>;
  bellman_ford_source_to_all(src: number): Promise<IgraphRawAlgorithmResult>;
  bfs(src: number): Promise<IgraphRawAlgorithmResult>;
  dfs(src: number): Promise<IgraphRawAlgorithmResult>;
  random_walk(start: number, steps: number): Promise<IgraphRawAlgorithmResult>;
  min_spanning_tree(): Promise<IgraphRawAlgorithmResult>;
  betweenness_centrality(): Promise<IgraphRawAlgorithmResult>;
  closeness_centrality(): Promise<IgraphRawAlgorithmResult>;
  degree_centrality(): Promise<IgraphRawAlgorithmResult>;
  eigenvector_centrality(): Promise<IgraphRawAlgorithmResult>;
  strength_centrality(): Promise<IgraphRawAlgorithmResult>;
  harmonic_centrality(): Promise<IgraphRawAlgorithmResult>;
  pagerank(damping: number): Promise<IgraphRawAlgorithmResult>;
  louvain(resolution: number): Promise<IgraphRawAlgorithmResult>;
  leiden(resolution: number): Promise<IgraphRawAlgorithmResult>;
  fast_greedy(): Promise<IgraphRawAlgorithmResult>;
  label_propagation(): Promise<IgraphRawAlgorithmResult>;
  local_clustering_coefficient(): Promise<IgraphRawAlgorithmResult>;
  k_core(k: number): Promise<IgraphRawAlgorithmResult>;
  triangle_count(): Promise<IgraphRawAlgorithmResult>;
  strongly_connected_components(): Promise<IgraphRawAlgorithmResult>;
  weakly_connected_components(): Promise<IgraphRawAlgorithmResult>;
  vertices_are_adjacent(src: number, tar: number): Promise<IgraphRawAlgorithmResult>;
  jaccard_similarity(jsVsList: unknown): Promise<IgraphRawAlgorithmResult>;
  topological_sort(): Promise<IgraphRawAlgorithmResult>;
  diameter(): Promise<IgraphRawAlgorithmResult>;
  eulerian_path(): Promise<IgraphRawAlgorithmResult>;
  eulerian_circuit(): Promise<IgraphRawAlgorithmResult>;
  missing_edge_prediction_default_values(): Promise<IgraphRawAlgorithmResult>;
  missing_edge_prediction(src: number, tar: number): Promise<IgraphRawAlgorithmResult>;
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

export const MODE = {
  COLOR_IMPORTANT: 1,
  COLOR_SHADE_DEFAULT: 2,
  COLOR_SHADE_ERROR: 3,
  SIZE_SCALAR: 4,
  RAINBOW: 5,
} as const;

export type GraphModule = IGraphModule;
