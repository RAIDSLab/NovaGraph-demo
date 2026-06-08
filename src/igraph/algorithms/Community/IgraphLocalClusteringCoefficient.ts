import type {
  BaseGraphAlgorithmResult,
  GraphModule,
  KuzuToIgraphParseResult,
} from "../../types";
import { createMapIdBack, mapColorMapIds } from "../../utils/mapIdBack";

import type { GraphNode } from "~/features/visualizer/types";
import { runTimedIgraphAlgorithm } from "~/igraph/utils/runIgraphAlgo";
import type { AlgorithmTimedResult } from "~/igraph/utils/runIgraphAlgo";

export type LocalClusteringCoefficientOutputData<T = string> = {
  algorithm: string;
  global_coefficient: number; // 4 dp, avg-ignore-zeros
  coefficients: {
    node: T; // vertex id
    value: number; // 4 dp (can be NaN when undefined)
  }[];
};

export type LocalClusteringCoefficientResult<T = string> =
  BaseGraphAlgorithmResult & {
    data: LocalClusteringCoefficientOutputData<T>;
  };

function _parseResult(
  IgraphToKuzu: Map<number, string>,
  nodesMap: Map<string, GraphNode>,
  algorithmResult: LocalClusteringCoefficientResult<number>
): LocalClusteringCoefficientResult {
  const { mapIdBack, mapLabelBack } = createMapIdBack(IgraphToKuzu, nodesMap);

  const { data, mode, colorMap = {} } = algorithmResult;

  return {
    mode,
    colorMap: mapColorMapIds(colorMap, mapIdBack),
    data: {
      algorithm: data.algorithm,
      global_coefficient: data.global_coefficient,
      coefficients: data.coefficients.map((coefficient) => ({
        node: mapLabelBack(coefficient.node),
        value: coefficient.value,
      })),
    },
  };
}

export async function igraphLocalClusteringCoefficient(
  igraphMod: GraphModule,
  graphData: KuzuToIgraphParseResult
): Promise<AlgorithmTimedResult<LocalClusteringCoefficientResult>> {
  return runTimedIgraphAlgorithm(
    igraphMod,
    (m) =>
    m.local_clustering_coefficient(),
    (wasmResult) =>
      _parseResult(
        graphData.IgraphToKuzuMap,
        graphData.nodesMap,
        wasmResult as LocalClusteringCoefficientResult<number>
      )
  );
}
