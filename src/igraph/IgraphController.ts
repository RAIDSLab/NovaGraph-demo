import { type BellmanFordAToAllResult } from "./algorithms/PathFinding/IgraphBellmanFordAToAll";
import type { BellmanFordAToBResult } from "./algorithms/PathFinding/IgraphBellmanFordAtoB";
import type { BFSResult } from "./algorithms/PathFinding/IgraphBFS";
import type { DFSResult } from "./algorithms/PathFinding/IgraphDFS";
import type { DijkstraAToAllResult } from "./algorithms/PathFinding/IgraphDijkstraAtoAll";
import type { DijkstraAToBResult } from "./algorithms/PathFinding/IgraphDijkstraAtoB";
import type { MSTResult } from "./algorithms/PathFinding/IgraphMST";
import type { RandomWalkResult } from "./algorithms/PathFinding/IgraphRandomWalk";
import type { YenResult } from "./algorithms/PathFinding/IgraphYen";
import type { BetweennessCentralityResult } from "./algorithms/Centrality/IgraphBetweenessCentrality";
import type { ClosenessCentralityResult } from "./algorithms/Centrality/IgraphCloseCentrality";
import type { DegreeCentralityResult } from "./algorithms/Centrality/IgraphDegreeCentrality";
import type { EigenvectorCentralityResult } from "./algorithms/Centrality/IgraphEigenvectorCentrality";
import type { HarmonicCentralityResult } from "./algorithms/Centrality/IgraphHarmonicCentrality";
import type { PageRankResult } from "./algorithms/Centrality/IgraphPageRank";
import type { StrengthCentralityResult } from "./algorithms/Centrality/IgraphStrengthCentrality";
import type { FastGreedyResult } from "./algorithms/Community/IgraphFastGreedy";
import type { KCoreResult } from "./algorithms/Community/IgraphKCore";
import type { LabelPropagationResult } from "./algorithms/Community/IgraphLabelPropagation";
import type { LeidenResult } from "./algorithms/Community/IgraphLeiden";
import type { LocalClusteringCoefficientResult } from "./algorithms/Community/IgraphLocalClusteringCoefficient";
import type { LouvainResult } from "./algorithms/Community/IgraphLouvain";
import type { SCCResult } from "./algorithms/Community/IgraphStronglyConnectedComponents";
import type { TriangleCountResult } from "./algorithms/Community/IgraphTriangles";
import type { WCCResult } from "./algorithms/Community/IgraphWeaklyConnectedComponents";
import type { GraphDiameterResult } from "./algorithms/Misc/IgraphDiameter";
import type { EulerianCircuitResult } from "./algorithms/Misc/IgraphEulerianCircuit";
import type { EulerianPathResult } from "./algorithms/Misc/IgraphEulerianPath";
import type { JaccardSimilarityResult } from "./algorithms/Misc/IgraphJaccardSimilarity";
import type { MissingEdgePredictionResult } from "./algorithms/Misc/IgraphMissingEdgePrediction";
import type { TopologicalSortResult } from "./algorithms/Misc/IgraphTopologicalSort";
import type { VerticesAreAdjacentResult } from "./algorithms/Misc/IgraphVerticesAreAdjacent";
import type { GraphModule } from "./types";
import type {
  IgraphWorkerAlgorithmName,
  IgraphWorkerGraphSnapshot,
  IgraphWorkerMessage,
  IgraphWorkerMessageData,
  IgraphWorkerMessageType,
  IgraphWorkerResponse,
  IgraphWorkerSyncGraphResult,
} from "./workers/types";
import {
  emptyBenchmarkTiming,
  mergeWorkerAndT4Timing,
  type BenchmarkTimingBuckets,
  type IgraphWorkerRunAlgorithmResponse,
  type WorkerBenchmarkTiming,
} from "./benchmark-timing";

import type {
  EdgeSchema,
  GraphEdge,
  GraphNode,
  NodeSchema,
} from "~/features/visualizer/types";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

type GraphSnapshotSource = () => Promise<{
  nodes: GraphNode[];
  edges: GraphEdge[];
  nodeTables: NodeSchema[];
  edgeTables: EdgeSchema[];
}>;

const WORKER_TIMEOUT_MS = 3600_000;

export class IgraphController {
  private _worker: Worker | null = null;
  private _messageId = 0;
  private _pendingRequests = new Map<number, PendingRequest>();
  private _initializePromise: Promise<void> | null = null;
  private _getKuzuData: GraphSnapshotSource;
  private _getDirection: () => boolean;

  /** Epoch bumps on graph invalidation; stale sync results are ignored. */
  private _graphEpoch = 0;
  private _syncedGraphVersion: string | null = null;
  private _syncInFlight: Promise<string | null> | null = null;
  private _lastBenchmarkTiming: BenchmarkTimingBuckets | null = null;

  constructor(getKuzuData: GraphSnapshotSource, getDirection: () => boolean) {
    this._getDirection = getDirection;
    this._getKuzuData = getKuzuData;
  }

  static toWorkerSnapshot(snapshot: {
    nodes: GraphNode[];
    edges: GraphEdge[];
    nodeTables: NodeSchema[];
    edgeTables: EdgeSchema[];
  }): IgraphWorkerGraphSnapshot {
    return {
      nodes: snapshot.nodes,
      edges: snapshot.edges,
      nodeTables: snapshot.nodeTables,
      edgeTables: snapshot.edgeTables,
    };
  }

  /** Graph changed in Kuzu/UI; drop worker version so the next run re-syncs. */
  invalidateGraphSync() {
    this._graphEpoch++;
    this._syncedGraphVersion = null;
  }

  /**
   * Push the current graph into the igraph worker (parse + WASM rebuild).
   * Prefer passing `graphSnapshot` from the visualizer store to avoid an extra Kuzu copy.
   */
  async syncGraph(graphSnapshot?: IgraphWorkerGraphSnapshot): Promise<string> {
    await this.initIgraph();
    const epoch = this._graphEpoch;
    const directed = this._getDirection();
    const snapshot =
      graphSnapshot ??
      (IgraphController.toWorkerSnapshot(
        await this._getKuzuData()
      ) as IgraphWorkerGraphSnapshot);

    const result = (await this._sendMessage("syncGraph", {
      directed,
      graphSnapshot: snapshot,
    })) as IgraphWorkerSyncGraphResult;

    if (epoch !== this._graphEpoch) {
      throw new Error("Graph sync was superseded by a newer graph change");
    }

    this._syncedGraphVersion = result.graphVersion;
    return result.graphVersion;
  }

  /**
   * Fire-and-forget background sync after connect or graph edits.
   */
  scheduleBackgroundGraphSync(graphSnapshot?: IgraphWorkerGraphSnapshot) {
    void this._scheduleSync(graphSnapshot).catch((error) => {
      console.warn("[IgraphController] Background graph sync failed:", error);
    });
  }

  private async _scheduleSync(
    graphSnapshot?: IgraphWorkerGraphSnapshot
  ): Promise<string | null> {
    if (this._syncInFlight) {
      return this._syncInFlight;
    }

    const task = (async () => {
      try {
        return await this.syncGraph(graphSnapshot);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("superseded by a newer graph change")
        ) {
          return null;
        }
        throw error;
      } finally {
        this._syncInFlight = null;
      }
    })();

    this._syncInFlight = task;
    return task;
  }

  private async _ensureGraphSyncedForRun(): Promise<string> {
    const epoch = this._graphEpoch;

    if (this._syncInFlight) {
      await this._syncInFlight;
    }

    if (epoch !== this._graphEpoch) {
      return this._ensureGraphSyncedForRun();
    }

    if (this._syncedGraphVersion) {
      return this._syncedGraphVersion;
    }

    const version = await this._scheduleSync();
    if (!version) {
      return this._ensureGraphSyncedForRun();
    }
    return version;
  }

  private _createWorker(): Worker {
    return new Worker(new URL("./workers/igraph.worker.ts", import.meta.url), {
      type: "module",
    });
  }

  private _handleWorkerError = (error: ErrorEvent) => {
    const message =
      error.message ||
      `Worker error at ${error.filename}:${error.lineno}:${error.colno}`;
    this._pendingRequests.forEach((request) => {
      request.reject(new Error(message));
    });
    this._pendingRequests.clear();
    this.invalidateGraphSync();
  };

  private async _sendMessage<T extends IgraphWorkerMessageType>(
    type: T,
    data: IgraphWorkerMessageData[T]
  ): Promise<unknown> {
    this.checkInitialization();
    const worker = this._worker;
    if (!worker) {
      throw new Error("Igraph worker is not initialized");
    }
    return new Promise((resolve, reject) => {
      const id = this._messageId++;
      this._pendingRequests.set(id, { resolve, reject });
      worker.postMessage({ id, type, data } as IgraphWorkerMessage<T>);

      setTimeout(() => {
        if (this._pendingRequests.has(id)) {
          this._pendingRequests.delete(id);
          reject(new Error(`Igraph operation timed out: ${type}`));
        }
      }, WORKER_TIMEOUT_MS);
    });
  }

  async initIgraph(): Promise<GraphModule | null> {
    if (this._initializePromise) {
      await this._initializePromise;
      return null;
    }

    this._initializePromise = (async () => {
      this._worker = this._createWorker();

      this._worker.onmessage = (event: MessageEvent<IgraphWorkerResponse>) => {
        const { id, data, error } = event.data;
        const pending = this._pendingRequests.get(id);
        if (!pending) return;

        this._pendingRequests.delete(id);
        if (error) {
          pending.reject(new Error(error));
        } else {
          pending.resolve(data);
        }
      };
      this._worker.onerror = this._handleWorkerError;
      this._worker.onmessageerror = () => {
        this._pendingRequests.forEach((request) => {
          request.reject(
            new Error("Igraph worker message deserialization failed")
          );
        });
        this._pendingRequests.clear();
        this.invalidateGraphSync();
      };

      await this._sendMessage("init", {});
    })().catch((error) => {
      this._worker?.terminate();
      this._worker = null;
      this._initializePromise = null;
      this.invalidateGraphSync();
      throw error;
    });

    await this._initializePromise;
    return null;
  }

  async dispose() {
    if (!this._worker) return;
    try {
      await this._sendMessage("dispose", {});
    } finally {
      this._worker.terminate();
      this._worker = null;
      this._initializePromise = null;
      this._pendingRequests.clear();
      this.invalidateGraphSync();
    }
  }

  getIgraphModule(): GraphModule | null {
    return null;
  }

  getSyncedGraphVersion(): string | null {
    return this._syncedGraphVersion;
  }

  getLastBenchmarkTiming(): BenchmarkTimingBuckets | null {
    return this._lastBenchmarkTiming;
  }

  private _unwrapRunAlgorithmResponse(
    data: unknown
  ): IgraphWorkerRunAlgorithmResponse {
    if (
      data &&
      typeof data === "object" &&
      "result" in data &&
      "benchmarkTiming" in data
    ) {
      return data as IgraphWorkerRunAlgorithmResponse;
    }
    const emptyWorker: WorkerBenchmarkTiming = {
      T1_graph_prep_ms: emptyBenchmarkTiming().T1_graph_prep_ms,
      T2_algorithm_core_ms: null,
      T3_result_postprocess_ms: null,
      worker_algorithm_ms: null,
    };
    return { result: data, benchmarkTiming: emptyWorker };
  }

  private async _invokeRunAlgorithm(
    runPayload: IgraphWorkerMessageData["runAlgorithm"]
  ): Promise<unknown> {
    const t4Start = performance.now();
    const raw = await this._sendMessage("runAlgorithm", runPayload);
    const t4Ms = performance.now() - t4Start;
    const { result, benchmarkTiming } = this._unwrapRunAlgorithmResponse(raw);
    this._lastBenchmarkTiming = mergeWorkerAndT4Timing(benchmarkTiming, t4Ms);
    return result;
  }

  private async _runAlgorithm<TResult>(
    algorithm: IgraphWorkerAlgorithmName,
    args: unknown[] = [],
    options?: {
      forceUndirected?: boolean;
      forceDirected?: boolean;
      requiresDirected?: boolean;
    }
  ): Promise<TResult> {
    await this.initIgraph();
    this.checkInitialization();

    const directed = this._getDirection();
    if (options?.requiresDirected && !directed) {
      throw new Error("This algorithm requires a directed graph");
    }

    let graphVersion = await this._ensureGraphSyncedForRun();

    const runPayload = {
      algorithm,
      args,
      directed,
      forceUndirected: options?.forceUndirected ?? false,
      forceDirected: options?.forceDirected ?? false,
      graphVersion,
    };

    try {
      return (await this._invokeRunAlgorithm(runPayload)) as TResult;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      if (!message.includes("out of sync")) {
        throw error;
      }

      // Worker lost cache (e.g. after dispose/recreate); resync once with full snapshot.
      this.invalidateGraphSync();
      const snapshot = IgraphController.toWorkerSnapshot(
        await this._getKuzuData()
      );
      graphVersion = await this.syncGraph(snapshot);
      return (await this._invokeRunAlgorithm({
        ...runPayload,
        graphVersion,
        graphSnapshot: snapshot,
      })) as TResult;
    }
  }

  // ==========================================
  // TRAVERSAL & CONNECTIVITY ALGORITHMS
  // ==========================================

  async bfs(kuzuSourceID: string): Promise<BFSResult> {
    return this._runAlgorithm<BFSResult>("bfs", [kuzuSourceID]);
  }

  async dfs(kuzuSourceID: string): Promise<DFSResult> {
    return this._runAlgorithm<DFSResult>("dfs", [kuzuSourceID]);
  }

  async stronglyConnectedComponents(): Promise<SCCResult> {
    return this._runAlgorithm<SCCResult>("stronglyConnectedComponents", [], {
      requiresDirected: true,
    });
  }

  async weaklyConnectedComponents(): Promise<WCCResult> {
    return this._runAlgorithm<WCCResult>("weaklyConnectedComponents");
  }

  async verticesAreAdjacent(
    source: string,
    target: string
  ): Promise<VerticesAreAdjacentResult> {
    return this._runAlgorithm<VerticesAreAdjacentResult>(
      "verticesAreAdjacent",
      [source, target]
    );
  }

  async topologicalSort(): Promise<TopologicalSortResult> {
    return this._runAlgorithm<TopologicalSortResult>("topologicalSort", [], {
      requiresDirected: true,
    });
  }

  // ==========================================
  // PATH & REACHABILITY ALGORITHMS
  // ==========================================

  async dijkstraAToB(start: string, end: string): Promise<DijkstraAToBResult> {
    return this._runAlgorithm<DijkstraAToBResult>("dijkstraAToB", [start, end]);
  }

  async dijkstraAToAll(start: string): Promise<DijkstraAToAllResult> {
    return this._runAlgorithm<DijkstraAToAllResult>("dijkstraAToAll", [start]);
  }

  async bellmanFordAToB(
    start: string,
    end: string
  ): Promise<BellmanFordAToBResult> {
    return this._runAlgorithm<BellmanFordAToBResult>("bellmanFordAToB", [
      start,
      end,
    ]);
  }

  async bellmanFordAToAll(start: string): Promise<BellmanFordAToAllResult> {
    return this._runAlgorithm<BellmanFordAToAllResult>("bellmanFordAToAll", [
      start,
    ]);
  }

  async randomWalk(start: string, steps: number): Promise<RandomWalkResult> {
    return this._runAlgorithm<RandomWalkResult>("randomWalk", [start, steps]);
  }

  async yenKShortestPaths(
    start: string,
    end: string,
    k: number
  ): Promise<YenResult> {
    return this._runAlgorithm<YenResult>("yenKShortestPaths", [start, end, k]);
  }

  async minimumSpanningTree(): Promise<MSTResult> {
    return this._runAlgorithm<MSTResult>("minimumSpanningTree", [], {
      forceUndirected: true,
    });
  }

  async graphDiameter(): Promise<GraphDiameterResult> {
    return this._runAlgorithm<GraphDiameterResult>("graphDiameter");
  }

  async eulerianPath(): Promise<EulerianPathResult> {
    return this._runAlgorithm<EulerianPathResult>("eulerianPath");
  }

  async eulerianCircuit(): Promise<EulerianCircuitResult> {
    return this._runAlgorithm<EulerianCircuitResult>("eulerianCircuit");
  }

  // ==========================================
  // CENTRALITY ALGORITHMS
  // ==========================================

  async betweennessCentrality(): Promise<BetweennessCentralityResult> {
    return this._runAlgorithm<BetweennessCentralityResult>(
      "betweennessCentrality"
    );
  }

  async closenessCentrality(): Promise<ClosenessCentralityResult> {
    return this._runAlgorithm<ClosenessCentralityResult>("closenessCentrality");
  }

  async degreeCentrality(): Promise<DegreeCentralityResult> {
    return this._runAlgorithm<DegreeCentralityResult>("degreeCentrality");
  }

  async eigenvectorCentrality(): Promise<EigenvectorCentralityResult> {
    return this._runAlgorithm<EigenvectorCentralityResult>(
      "eigenvectorCentrality"
    );
  }

  async harmonicCentrality(): Promise<HarmonicCentralityResult> {
    return this._runAlgorithm<HarmonicCentralityResult>("harmonicCentrality");
  }

  async strengthCentrality(): Promise<StrengthCentralityResult> {
    return this._runAlgorithm<StrengthCentralityResult>("strengthCentrality");
  }

  async pageRank(damping: number): Promise<PageRankResult> {
    return this._runAlgorithm<PageRankResult>("pageRank", [damping], {
      requiresDirected: true,
    });
  }

  // ==========================================
  // COMMUNITY DETECTION ALGORITHMS
  // ==========================================

  async louvainCommunities(resolution: number): Promise<LouvainResult> {
    return this._runAlgorithm<LouvainResult>(
      "louvainCommunities",
      [resolution],
      {
        forceUndirected: true,
      }
    );
  }

  async leidenCommunities(resolution: number): Promise<LeidenResult> {
    return this._runAlgorithm<LeidenResult>("leidenCommunities", [resolution], {
      forceUndirected: true,
    });
  }

  async fastGreedyCommunities(): Promise<FastGreedyResult> {
    return this._runAlgorithm<FastGreedyResult>("fastGreedyCommunities", [], {
      forceUndirected: true,
    });
  }

  async labelPropagation(): Promise<LabelPropagationResult> {
    return this._runAlgorithm<LabelPropagationResult>("labelPropagation", [], {
      forceUndirected: true,
    });
  }

  async localClusteringCoefficient(): Promise<LocalClusteringCoefficientResult> {
    return this._runAlgorithm<LocalClusteringCoefficientResult>(
      "localClusteringCoefficient",
      [],
      { forceUndirected: true }
    );
  }

  async kCore(k: number): Promise<KCoreResult> {
    return this._runAlgorithm<KCoreResult>("kCore", [k], {
      forceUndirected: true,
    });
  }

  async triangles(): Promise<TriangleCountResult> {
    return this._runAlgorithm<TriangleCountResult>("triangles", [], {
      forceUndirected: true,
    });
  }

  // ==========================================
  // SIMILARITY & MATCHING ALGORITHMS
  // ==========================================

  async jaccardSimilarity(nodes: string[]): Promise<JaccardSimilarityResult> {
    return this._runAlgorithm<JaccardSimilarityResult>("jaccardSimilarity", [
      nodes,
    ]);
  }

  async missingEdgePrediction(
    sampleSize: number,
    numBins: number
  ): Promise<MissingEdgePredictionResult> {
    return this._runAlgorithm<MissingEdgePredictionResult>(
      "missingEdgePrediction",
      [sampleSize, numBins],
      { forceUndirected: true }
    );
  }

  protected checkInitialization() {
    if (!this._worker) {
      throw new Error("Igraph worker is not initialized");
    }
  }
}
