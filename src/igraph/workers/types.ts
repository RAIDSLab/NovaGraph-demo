import type {
  EdgeSchema,
  GraphEdge,
  GraphNode,
  NodeSchema,
} from "~/features/visualizer/types";

export type IgraphWorkerAlgorithmName =
  | "bfs"
  | "dfs"
  | "stronglyConnectedComponents"
  | "weaklyConnectedComponents"
  | "verticesAreAdjacent"
  | "topologicalSort"
  | "dijkstraAToB"
  | "dijkstraAToAll"
  | "bellmanFordAToB"
  | "bellmanFordAToAll"
  | "randomWalk"
  | "yenKShortestPaths"
  | "minimumSpanningTree"
  | "graphDiameter"
  | "eulerianPath"
  | "eulerianCircuit"
  | "betweennessCentrality"
  | "closenessCentrality"
  | "degreeCentrality"
  | "eigenvectorCentrality"
  | "harmonicCentrality"
  | "strengthCentrality"
  | "pageRank"
  | "louvainCommunities"
  | "leidenCommunities"
  | "fastGreedyCommunities"
  | "labelPropagation"
  | "localClusteringCoefficient"
  | "kCore"
  | "triangles"
  | "jaccardSimilarity"
  | "missingEdgePrediction";

export type IgraphWorkerGraphSnapshot = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  nodeTables: NodeSchema[];
  edgeTables: EdgeSchema[];
};

export type IgraphWorkerMessageType =
  | "init"
  | "syncGraph"
  | "runAlgorithm"
  | "dispose";

export type IgraphWorkerSyncGraphPayload = {
  directed: boolean;
  graphSnapshot: IgraphWorkerGraphSnapshot;
};

export type IgraphWorkerRunAlgorithmPayload = {
  algorithm: IgraphWorkerAlgorithmName;
  args: unknown[];
  directed: boolean;
  forceUndirected?: boolean;
  forceDirected?: boolean;
  /** When set and matches the worker's prepared graph, snapshot is not required. */
  graphVersion?: string;
  /** Full snapshot when version is absent or the worker has no cached graph. */
  graphSnapshot?: IgraphWorkerGraphSnapshot;
};

export type IgraphWorkerSyncGraphResult = {
  graphVersion: string;
  directed: boolean;
};

export type IgraphWorkerMessageData = {
  init: Record<string, never>;
  syncGraph: IgraphWorkerSyncGraphPayload;
  runAlgorithm: IgraphWorkerRunAlgorithmPayload;
  dispose: Record<string, never>;
};

export type IgraphWorkerMessage<T extends IgraphWorkerMessageType> = {
  id: number;
  type: T;
  data: IgraphWorkerMessageData[T];
};

export type IgraphWorkerResponse = {
  id: number;
  type: IgraphWorkerMessageType;
  data?: unknown;
  error?: string;
};
