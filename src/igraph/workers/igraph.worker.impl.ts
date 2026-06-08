import createModule from "../../graph";
import { igraphBFS, type BFSResult } from "../algorithms/PathFinding/IgraphBFS";
import { igraphDFS, type DFSResult } from "../algorithms/PathFinding/IgraphDFS";
import {
  igraphDijkstraAToB,
  type DijkstraAToBResult,
} from "../algorithms/PathFinding/IgraphDijkstraAtoB";
import {
  igraphDijkstraAToAll,
  type DijkstraAToAllResult,
} from "../algorithms/PathFinding/IgraphDijkstraAtoAll";
import { igraphYen, type YenResult } from "../algorithms/PathFinding/IgraphYen";
import {
  igraphBellmanFordAToB,
  type BellmanFordAToBResult,
} from "../algorithms/PathFinding/IgraphBellmanFordAtoB";
import {
  igraphBellmanFordAToAll,
  type BellmanFordAToAllResult,
} from "../algorithms/PathFinding/IgraphBellmanFordAToAll";
import {
  igraphRandomWalk,
  type RandomWalkResult,
} from "../algorithms/PathFinding/IgraphRandomWalk";
import { igraphMST, type MSTResult } from "../algorithms/PathFinding/IgraphMST";
import {
  igraphBetweennessCentrality,
  type BetweennessCentralityResult,
} from "../algorithms/Centrality/IgraphBetweenessCentrality";
import {
  igraphClosenessCentrality,
  type ClosenessCentralityResult,
} from "../algorithms/Centrality/IgraphCloseCentrality";
import {
  igraphDegreeCentrality,
  type DegreeCentralityResult,
} from "../algorithms/Centrality/IgraphDegreeCentrality";
import {
  igraphEigenvectorCentrality,
  type EigenvectorCentralityResult,
} from "../algorithms/Centrality/IgraphEigenvectorCentrality";
import {
  igraphHarmonicCentrality,
  type HarmonicCentralityResult,
} from "../algorithms/Centrality/IgraphHarmonicCentrality";
import {
  igraphStrengthCentrality,
  type StrengthCentralityResult,
} from "../algorithms/Centrality/IgraphStrengthCentrality";
import {
  igraphPageRank,
  type PageRankResult,
} from "../algorithms/Centrality/IgraphPageRank";
import {
  igraphLouvain,
  type LouvainResult,
} from "../algorithms/Community/IgraphLouvain";
import {
  igraphLeiden,
  type LeidenResult,
} from "../algorithms/Community/IgraphLeiden";
import {
  igraphFastGreedy,
  type FastGreedyResult,
} from "../algorithms/Community/IgraphFastGreedy";
import {
  igraphLabelPropagation,
  type LabelPropagationResult,
} from "../algorithms/Community/IgraphLabelPropagation";
import {
  igraphLocalClusteringCoefficient,
  type LocalClusteringCoefficientResult,
} from "../algorithms/Community/IgraphLocalClusteringCoefficient";
import {
  igraphKCore,
  type KCoreResult,
} from "../algorithms/Community/IgraphKCore";
import {
  igraphTriangles,
  type TriangleCountResult,
} from "../algorithms/Community/IgraphTriangles";
import {
  igraphStronglyConnectedComponents,
  type SCCResult,
} from "../algorithms/Community/IgraphStronglyConnectedComponents";
import {
  igraphWeaklyConnectedComponents,
  type WCCResult,
} from "../algorithms/Community/IgraphWeaklyConnectedComponents";
import {
  igraphVerticesAreAdjacent,
  type VerticesAreAdjacentResult,
} from "../algorithms/Misc/IgraphVerticesAreAdjacent";
import {
  igraphTopologicalSort,
  type TopologicalSortResult,
} from "../algorithms/Misc/IgraphTopologicalSort";
import {
  igraphDiameter,
  type GraphDiameterResult,
} from "../algorithms/Misc/IgraphDiameter";
import {
  igraphEulerianPath,
  type EulerianPathResult,
} from "../algorithms/Misc/IgraphEulerianPath";
import {
  igraphEulerianCircuit,
  type EulerianCircuitResult,
} from "../algorithms/Misc/IgraphEulerianCircuit";
import {
  igraphMissingEdgePrediction,
  type MissingEdgePredictionResult,
} from "../algorithms/Misc/IgraphMissingEdgePrediction";
import {
  igraphJaccardSimilarity,
  type JaccardSimilarityResult,
} from "../algorithms/Misc/IgraphJaccardSimilarity";
import type { GraphModule, KuzuToIgraphParseResult } from "../types";
import { parseKuzuToIgraphInput } from "../utils/parseKuzuToIgraphInput";
import {
  emptyGraphPrepTiming,
  type GraphPrepTiming,
  type IgraphWorkerRunAlgorithmResponse,
  type WorkerBenchmarkTiming,
} from "../benchmark-timing";

import { computeGraphFingerprint } from "../utils/graphFingerprint";
import type {
  AlgorithmSegmentTiming,
  AlgorithmTimedResult,
} from "../utils/runIgraphAlgo";

import type {
  IgraphWorkerGraphSnapshot,
  IgraphWorkerMessage,
  IgraphWorkerResponse,
  IgraphWorkerMessageType,
  IgraphWorkerRunAlgorithmPayload,
  IgraphWorkerSyncGraphPayload,
} from "./types";

type WorkerAlgorithmResult =
  | BFSResult
  | DFSResult
  | SCCResult
  | WCCResult
  | VerticesAreAdjacentResult
  | TopologicalSortResult
  | DijkstraAToBResult
  | DijkstraAToAllResult
  | BellmanFordAToBResult
  | BellmanFordAToAllResult
  | RandomWalkResult
  | YenResult
  | MSTResult
  | GraphDiameterResult
  | EulerianPathResult
  | EulerianCircuitResult
  | BetweennessCentralityResult
  | ClosenessCentralityResult
  | DegreeCentralityResult
  | EigenvectorCentralityResult
  | HarmonicCentralityResult
  | StrengthCentralityResult
  | PageRankResult
  | LouvainResult
  | LeidenResult
  | FastGreedyResult
  | LabelPropagationResult
  | LocalClusteringCoefficientResult
  | KCoreResult
  | TriangleCountResult
  | JaccardSimilarityResult
  | MissingEdgePredictionResult;

let moduleInstance: GraphModule | null = null;
let preparedGraphFingerprint: string | null = null;
let cachedGraphSnapshot: IgraphWorkerGraphSnapshot | null = null;
/** Maps to `wasm_module_init_ms` in benchmark timing (JS module init time). */
let wasmModuleInitMs: number | null = null;

const getModule = async (): Promise<GraphModule> => {
  if (!moduleInstance) {
    const t0 = performance.now();
    moduleInstance = await createModule();
    wasmModuleInitMs = performance.now() - t0;
  }
  return moduleInstance;
};

const resolveGraphSnapshot = (
  payload: IgraphWorkerRunAlgorithmPayload
): IgraphWorkerGraphSnapshot => {
  if (payload.graphSnapshot) {
    return payload.graphSnapshot;
  }
  if (
    payload.graphVersion &&
    payload.graphVersion === preparedGraphFingerprint &&
    cachedGraphSnapshot
  ) {
    return cachedGraphSnapshot;
  }
  throw new Error(
    "Igraph worker graph is out of sync. Provide graphSnapshot or call syncGraph first."
  );
};

const prepareGraphData = async ({
  graphSnapshot,
  directed,
  forceUndirected,
  forceDirected,
}: {
  graphSnapshot: IgraphWorkerGraphSnapshot;
  directed: boolean;
  forceUndirected?: boolean;
  forceDirected?: boolean;
}): Promise<{ parseResult: KuzuToIgraphParseResult; prepTiming: GraphPrepTiming }> => {
  const nextDirected = forceDirected ? true : forceUndirected ? false : directed;
  const parseStart = performance.now();
  const parseResult = parseKuzuToIgraphInput(
    graphSnapshot.nodes,
    graphSnapshot.edges,
    nextDirected
  );
  const parseMs = performance.now() - parseStart;
  const graphHash = computeGraphFingerprint(parseResult);
  const mod = await getModule();
  const initMs = wasmModuleInitMs;
  wasmModuleInitMs = null;

  const cacheHit = graphHash === preparedGraphFingerprint;
  let createMs = 0;
  if (!cacheHit) {
    const createStart = performance.now();
    const input = parseResult.IgraphInput;
    await mod.cleanupGraph();
    await mod.create_graph_from_kuzu_to_igraph(
      input.nodes,
      input.src,
      input.dst,
      input.directed,
      input.weight
    );
    createMs = performance.now() - createStart;
    preparedGraphFingerprint = graphHash;
  }

  const prepTiming: GraphPrepTiming = {
    ...emptyGraphPrepTiming(),
    total_ms: parseMs + (initMs ?? 0) + createMs,
    parse_kuzu_to_igraph_ms: parseMs,
    wasm_module_init_ms: initMs,
    create_graph_ms: cacheHit ? 0 : createMs,
    graph_cache_hit: cacheHit,
  };

  return { parseResult, prepTiming };
};

const syncGraph = async (
  payload: IgraphWorkerSyncGraphPayload
): Promise<{ graphVersion: string; directed: boolean }> => {
  cachedGraphSnapshot = payload.graphSnapshot;
  await prepareGraphData({
    graphSnapshot: payload.graphSnapshot,
    directed: payload.directed,
    forceUndirected: false,
  });
  if (!preparedGraphFingerprint) {
    throw new Error("Failed to prepare igraph graph during sync");
  }
  return {
    graphVersion: preparedGraphFingerprint,
    directed: payload.directed,
  };
};

const runTimed = async <T extends WorkerAlgorithmResult>(
  fn: () => Promise<AlgorithmTimedResult<T>>
): Promise<{ result: T; segmentTiming: AlgorithmSegmentTiming }> => {
  const timed = await fn();
  return { result: timed.result, segmentTiming: timed.segmentTiming };
};

const executeAlgorithm = async (
  mod: GraphModule,
  graphData: KuzuToIgraphParseResult,
  payload: IgraphWorkerRunAlgorithmPayload
): Promise<{ result: WorkerAlgorithmResult; segmentTiming: AlgorithmSegmentTiming }> => {
  const args = payload.args;
  switch (payload.algorithm) {
    case "bfs":
      return runTimed(() => igraphBFS(mod, graphData, String(args[0])));
    case "dfs":
      return runTimed(() => igraphDFS(mod, graphData, String(args[0])));
    case "stronglyConnectedComponents":
      return runTimed(() => igraphStronglyConnectedComponents(mod, graphData));
    case "weaklyConnectedComponents":
      return runTimed(() => igraphWeaklyConnectedComponents(mod, graphData));
    case "verticesAreAdjacent":
      return runTimed(() =>
        igraphVerticesAreAdjacent(
          mod,
          graphData,
          String(args[0]),
          String(args[1])
        )
      );
    case "topologicalSort":
      return runTimed(() => igraphTopologicalSort(mod, graphData));
    case "dijkstraAToB":
      return runTimed(() =>
        igraphDijkstraAToB(mod, graphData, String(args[0]), String(args[1]))
      );
    case "dijkstraAToAll":
      return runTimed(() => igraphDijkstraAToAll(mod, graphData, String(args[0])));
    case "bellmanFordAToB":
      return runTimed(() =>
        igraphBellmanFordAToB(mod, graphData, String(args[0]), String(args[1]))
      );
    case "bellmanFordAToAll":
      return runTimed(() => igraphBellmanFordAToAll(mod, graphData, String(args[0])));
    case "randomWalk":
      return runTimed(() =>
        igraphRandomWalk(mod, graphData, String(args[0]), Number(args[1]))
      );
    case "yenKShortestPaths":
      return runTimed(() =>
        igraphYen(mod, graphData, String(args[0]), String(args[1]), Number(args[2]))
      );
    case "minimumSpanningTree":
      return runTimed(() => igraphMST(mod, graphData));
    case "graphDiameter":
      return runTimed(() => igraphDiameter(mod, graphData));
    case "eulerianPath":
      return runTimed(() => igraphEulerianPath(mod, graphData));
    case "eulerianCircuit":
      return runTimed(() => igraphEulerianCircuit(mod, graphData));
    case "betweennessCentrality":
      return runTimed(() => igraphBetweennessCentrality(mod, graphData));
    case "closenessCentrality":
      return runTimed(() => igraphClosenessCentrality(mod, graphData));
    case "degreeCentrality":
      return runTimed(() => igraphDegreeCentrality(mod, graphData));
    case "eigenvectorCentrality":
      return runTimed(() => igraphEigenvectorCentrality(mod, graphData));
    case "harmonicCentrality":
      return runTimed(() => igraphHarmonicCentrality(mod, graphData));
    case "strengthCentrality":
      return runTimed(() => igraphStrengthCentrality(mod, graphData));
    case "pageRank":
      return runTimed(() => igraphPageRank(mod, graphData, Number(args[0])));
    case "louvainCommunities":
      return runTimed(() => igraphLouvain(mod, graphData, Number(args[0])));
    case "leidenCommunities":
      return runTimed(() => igraphLeiden(mod, graphData, Number(args[0])));
    case "fastGreedyCommunities":
      return runTimed(() => igraphFastGreedy(mod, graphData));
    case "labelPropagation":
      return runTimed(() => igraphLabelPropagation(mod, graphData));
    case "localClusteringCoefficient":
      return runTimed(() => igraphLocalClusteringCoefficient(mod, graphData));
    case "kCore":
      return runTimed(() => igraphKCore(mod, graphData, Number(args[0])));
    case "triangles":
      return runTimed(() => igraphTriangles(mod, graphData));
    case "jaccardSimilarity":
      return runTimed(() => igraphJaccardSimilarity(mod, graphData, args[0] as string[]));
    case "missingEdgePrediction":
      return runTimed(() =>
        igraphMissingEdgePrediction(mod, graphData, Number(args[0]), Number(args[1]))
      );
    default:
      throw new Error(`Unsupported algorithm: ${payload.algorithm}`);
  }
};

const runAlgorithm = async (
  payload: IgraphWorkerRunAlgorithmPayload
): Promise<IgraphWorkerRunAlgorithmResponse<WorkerAlgorithmResult>> => {
  const mod = await getModule();
  const graphSnapshot = resolveGraphSnapshot(payload);
  const { parseResult: graphData, prepTiming } = await prepareGraphData({
    graphSnapshot,
    directed: payload.directed,
    forceUndirected: payload.forceUndirected,
    forceDirected: payload.forceDirected,
  });

  const { result, segmentTiming } = await executeAlgorithm(mod, graphData, payload);

  const benchmarkTiming: WorkerBenchmarkTiming = {
    T1_graph_prep_ms: prepTiming,
    T2_algorithm_core_ms: segmentTiming.T2_algorithm_core_ms,
    T3_result_postprocess_ms: segmentTiming.T3_result_postprocess_ms,
    worker_algorithm_ms:
      segmentTiming.T2_algorithm_core_ms + segmentTiming.T3_result_postprocess_ms,
  };

  return { result, benchmarkTiming };
};

const postResponse = (response: IgraphWorkerResponse) => {
  self.postMessage(response);
};

self.onmessage = async (
  event: MessageEvent<IgraphWorkerMessage<IgraphWorkerMessageType>>
) => {
  const { id, type } = event.data;

  try {
    switch (type) {
      case "init": {
        await getModule();
        postResponse({ id, type, data: { initialized: true } });
        break;
      }
      case "runAlgorithm": {
        const payload = event.data as IgraphWorkerMessage<"runAlgorithm">;
        const result = await runAlgorithm(payload.data);
        postResponse({ id, type, data: result });
        break;
      }
      case "dispose": {
        if (moduleInstance) {
          try {
            await moduleInstance.cleanupGraph();
          } catch {
            // Ignore cleanup errors during teardown.
          }
        }
        preparedGraphFingerprint = null;
        cachedGraphSnapshot = null;
        moduleInstance = null;
        wasmModuleInitMs = null;
        postResponse({ id, type, data: { disposed: true } });
        break;
      }
      case "syncGraph": {
        const payload = event.data as IgraphWorkerMessage<"syncGraph">;
        const result = await syncGraph(payload.data);
        postResponse({ id, type, data: result });
        break;
      }
      default:
        throw new Error(`Unsupported worker message type: ${String(type)}`);
    }
  } catch (error) {
    postResponse({
      id,
      type,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export {};
