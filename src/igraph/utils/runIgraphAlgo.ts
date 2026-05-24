import type { GraphModule } from "../types";

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
 * T2 = WASM call; T3 = parse / label mapping in JS.
 */
export async function runTimedIgraphAlgorithm<M extends GraphModule, Raw, Parsed>(
  mod: M,
  wasmExec: (m: M) => Promise<Raw> | Raw,
  parse: (raw: Raw) => Parsed
): Promise<AlgorithmTimedResult<Parsed>> {
  const t2Start = performance.now();
  const raw = await _runIgraphAlgo(mod, wasmExec);
  const T2_algorithm_core_ms = performance.now() - t2Start;

  const t3Start = performance.now();
  const result = parse(raw);
  const T3_result_postprocess_ms = performance.now() - t3Start;

  return {
    result,
    segmentTiming: { T2_algorithm_core_ms, T3_result_postprocess_ms },
  };
}
