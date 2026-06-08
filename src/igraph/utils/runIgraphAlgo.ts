import type { GraphModule, IgraphRawAlgorithmResult } from "../types";

export type AlgorithmSegmentTiming = {
  T2_algorithm_core_ms: number;
  T3_result_postprocess_ms: number;
};

export type AlgorithmTimedResult<T> = {
  result: T;
  segmentTiming: AlgorithmSegmentTiming;
};

export async function _runIgraphAlgo<M extends GraphModule, R>(
  mod: M,
  exec: (m: M) => Promise<R> | R
): Promise<R> {
  try {
    return await exec(mod);
  } catch (e) {
    throw new Error(typeof e === "number" ? mod.what_to_stderr(e) : String(e));
  }
}

/**
 * T2 = algorithm core call; T3 = _parseResult / label mapping (BENCHMARK_TIMING_SPEC §3.2).
 */
export async function runTimedIgraphAlgorithm<M extends GraphModule, Parsed>(
  mod: M,
  algoExec: (m: M) => Promise<IgraphRawAlgorithmResult> | IgraphRawAlgorithmResult,
  parse: (raw: IgraphRawAlgorithmResult) => Parsed
): Promise<AlgorithmTimedResult<Parsed>> {
  const t2Start = performance.now();
  const raw = await _runIgraphAlgo(mod, algoExec);
  const T2_algorithm_core_ms = performance.now() - t2Start;

  const t3Start = performance.now();
  const result = parse(raw);
  const T3_result_postprocess_ms = performance.now() - t3Start;

  return {
    result,
    segmentTiming: { T2_algorithm_core_ms, T3_result_postprocess_ms },
  };
}
