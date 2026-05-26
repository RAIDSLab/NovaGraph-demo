/**
 * Benchmark timing buckets (T0–T5) — see thesis-benchmark-test/shared/BENCHMARK_TIMING_SPEC.md
 */

export type GraphPrepTiming = {
  total_ms: number | null;
  parse_kuzu_to_igraph_ms: number | null;
  wasm_module_init_ms: number | null;
  create_graph_ms: number | null;
  gds_drop_ms: null;
  gds_project_ms: null;
  graph_cache_hit: boolean | null;
};

export type BenchmarkTimingBuckets = {
  T0_import_ms: number | null;
  T1_graph_prep_ms: GraphPrepTiming;
  T2_algorithm_core_ms: number | null;
  T3_result_postprocess_ms: number | null;
  T4_system_invoke_ms: number | null;
  T5_ui_e2e_ms: number | null;
  neo4j_server_reported_ms: null;
  primary_prepared_invoke_ms: number | null;
  cold_first_run_ms: number | null;
};

export type WorkerBenchmarkTiming = {
  T1_graph_prep_ms: GraphPrepTiming;
  T2_algorithm_core_ms: number | null;
  T3_result_postprocess_ms: number | null;
  worker_algorithm_ms: number | null;
};

export type IgraphWorkerRunAlgorithmResponse<TResult = unknown> = {
  result: TResult;
  benchmarkTiming: WorkerBenchmarkTiming;
};

export const BENCHMARK_TIMING_LOG_PREFIX = "[BenchmarkTiming]";

/** Algorithm dialog titles → BCxx (for run-benchmark-auto.mjs caseId filter). */
export const BENCHMARK_CASE_ID_BY_OPERATION: Record<string, string> = {
  "Breadth-First Search": "BC01",
  "Depth-First Search": "BC02",
  "Check Adjacency": "BC03",
  "Random Walk": "BC04",
  "Strongly Connected (SCC)": "BC05",
  "Topological Sort": "BC06",
  "Weakly Connected (WCC)": "BC07",
  "Bellman-Ford (A to B)": "BC08",
  "Bellman-Ford (A to All)": "BC09",
  "Dijkstra (A to B)": "BC10",
  "Dijkstra (A to All)": "BC11",
  "Eulerian Circuit": "BC12",
  "Eulerian Path": "BC13",
  "Graph Diameter": "BC14",
  "Minimum Spanning Tree": "BC15",
  "Yen's K Shortest Paths": "BC16",
  "Betweenness Centrality": "BC17",
  "Closeness Centrality": "BC18",
  "Degree Centrality": "BC19",
  "Harmonic Centrality": "BC20",
  "Node Strength": "BC21",
  "Page Rank": "BC22",
  "Fast Greedy Algorithm": "BC23",
  "K-Core Decomposition": "BC24",
  "Label Propagation": "BC25",
  "Leiden Algorithm": "BC26",
  "Local Clustering Coefficient": "BC27",
  "Louvain Algorithm": "BC28",
  "Triangle Count": "BC29",
  "Jaccard Similarity": "BC30",
  "Missing Edge Prediction": "BC31",
  importFromCSV: "BC00",
};

export function emptyGraphPrepTiming(): GraphPrepTiming {
  return {
    total_ms: null,
    parse_kuzu_to_igraph_ms: null,
    wasm_module_init_ms: null,
    create_graph_ms: null,
    gds_drop_ms: null,
    gds_project_ms: null,
    graph_cache_hit: null,
  };
}

export function emptyBenchmarkTiming(): BenchmarkTimingBuckets {
  return {
    T0_import_ms: null,
    T1_graph_prep_ms: emptyGraphPrepTiming(),
    T2_algorithm_core_ms: null,
    T3_result_postprocess_ms: null,
    T4_system_invoke_ms: null,
    T5_ui_e2e_ms: null,
    neo4j_server_reported_ms: null,
    primary_prepared_invoke_ms: null,
    cold_first_run_ms: null,
  };
}

export function computePrimaryPreparedInvokeMs(
  timing: Pick<
    BenchmarkTimingBuckets,
    "T2_algorithm_core_ms" | "T3_result_postprocess_ms" | "T4_system_invoke_ms"
  >
): number | null {
  if (timing.T4_system_invoke_ms != null) {
    return timing.T4_system_invoke_ms;
  }
  const parts = [timing.T2_algorithm_core_ms, timing.T3_result_postprocess_ms].filter(
    (v): v is number => v != null
  );
  if (parts.length === 0) return null;
  return parts.reduce((a, b) => a + b, 0);
}

export function mergeWorkerAndT4Timing(
  workerTiming: WorkerBenchmarkTiming,
  t4Ms: number
): BenchmarkTimingBuckets {
  const timing = emptyBenchmarkTiming();
  timing.T1_graph_prep_ms = {
    ...timing.T1_graph_prep_ms,
    ...workerTiming.T1_graph_prep_ms,
  };
  timing.T2_algorithm_core_ms = workerTiming.T2_algorithm_core_ms;
  timing.T3_result_postprocess_ms = workerTiming.T3_result_postprocess_ms;
  timing.T4_system_invoke_ms = t4Ms;
  timing.primary_prepared_invoke_ms = computePrimaryPreparedInvokeMs(timing);

  const t1Total = timing.T1_graph_prep_ms.total_ms;
  if (t1Total != null && timing.primary_prepared_invoke_ms != null) {
    timing.cold_first_run_ms = t1Total + timing.primary_prepared_invoke_ms;
  }
  return timing;
}

declare global {
  // Playwright fallback when page console events are missed (e.g. system Chrome on WSL)
  // eslint-disable-next-line no-var
  var __novagraphBenchmarkTimings: Array<{
    engine: string;
    operation: string;
    caseId?: string;
    timing: BenchmarkTimingBuckets;
    input?: unknown;
    output?: unknown;
    ts: number;
  }>;
}

/** Structured log consumed by run-benchmark-auto.mjs */
export function logBenchmarkTiming(payload: {
  caseId?: string;
  operation: string;
  timing: BenchmarkTimingBuckets;
  input?: unknown;
  output?: unknown;
}) {
  const caseId =
    payload.caseId ?? BENCHMARK_CASE_ID_BY_OPERATION[payload.operation] ?? undefined;
  const entry = {
    engine: "novagraph" as const,
    ...payload,
    caseId,
    ts: Date.now(),
  };
  console.log(`${BENCHMARK_TIMING_LOG_PREFIX} ${JSON.stringify(entry)}`);
  if (typeof globalThis !== "undefined") {
    globalThis.__novagraphBenchmarkTimings =
      globalThis.__novagraphBenchmarkTimings ?? [];
    globalThis.__novagraphBenchmarkTimings.push(entry);
  }
}
