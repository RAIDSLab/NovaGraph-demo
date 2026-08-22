import type { ReactNode } from "react";

import type { InputType } from "../../inputs";
import type { BuildSliceStepsFn } from "../../layer-slice";

import type { IgraphController } from "~/igraph/IgraphController";
import type { BaseGraphAlgorithmResult as IgraphBaseGraphAlgorithmResult } from "~/igraph/types";

export type BaseGraphAlgorithmResult = {
  type: "algorithm";
} & IgraphBaseGraphAlgorithmResult;

/**
 * Opt-in metadata describing how a result may be diffed against another run.
 * Declared here rather than sniffed from `data` field names so that unrelated
 * algorithms sharing a field name (connectivity `components` versus modularity
 * `communities`) are never compared against each other.
 */
export type CompareFamily =
  | "centrality"
  | "clustering"
  | "community"
  | "connectivity";

export type CompareDescriptor = {
  kind: "node-score" | "partition";
  /** Only runs within the same family may be compared. */
  family: CompareFamily;
  /** Raw score deltas are only meaningful within the same metric. */
  metric: string;
  /** Field on `data` carrying the comparable payload. */
  dataKey: "centralities" | "coefficients" | "communities" | "components";
};

export interface GraphAlgorithmResult<TData = unknown>
  extends BaseGraphAlgorithmResult {
  data: TData;
}

type BivariantHandler<T> = {
  bivarianceHack(props: T): ReactNode;
}["bivarianceHack"];

// Type-erased base algorithm for generic lists
export interface BaseGraphAlgorithm<TResult = BaseGraphAlgorithmResult> {
  title: string;
  description: string;
  inputs: InputType[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wasmFunction: (controller: IgraphController, args: any[]) => Promise<TResult>;
  output: BivariantHandler<TResult>;
  /** Optional post-run layer-slice builder (display labels → Kuzu IDs via ctx). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildSliceSteps?: BuildSliceStepsFn<any>;
  /** Present only on algorithms whose results support run-to-run comparison. */
  compare?: CompareDescriptor;
}

/** TData describes the format/structure of the output in addition from
 * colorMap, sizeMap, etc. Please refer to wasm/algorithms/ to inspect
 * the correct structure for your algorithm
 */
export interface GraphAlgorithm<TData = unknown>
  extends BaseGraphAlgorithm<GraphAlgorithmResult<TData>> {}

// Helper function for better type inference
export function createGraphAlgorithm<TData>(config: {
  title: string;
  description: string;
  inputs: InputType[];
  wasmFunction: (
    controller: IgraphController,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args: any[]
  ) => Promise<Omit<GraphAlgorithmResult<TData>, "type">>;
  output: (props: GraphAlgorithmResult<TData>) => ReactNode;
  buildSliceSteps?: BuildSliceStepsFn<TData>;
  compare?: CompareDescriptor;
}): GraphAlgorithm<TData> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const algorithmWasmFn = async (controller: IgraphController, args: any[]) => {
    const rawResult = await config.wasmFunction(controller, args);
    return { ...rawResult, type: "algorithm" } as const;
  };
  return { ...config, wasmFunction: algorithmWasmFn };
}
