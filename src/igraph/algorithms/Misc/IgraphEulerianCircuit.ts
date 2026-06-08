import type {
  BaseGraphAlgorithmResult,
  GraphModule,
  KuzuToIgraphParseResult,
} from "../../types";
import { createMapIdBack, mapColorMapIds } from "../../utils/mapIdBack";

import type { GraphNode } from "~/features/visualizer/types";
import { runTimedIgraphAlgorithm } from "~/igraph/utils/runIgraphAlgo";
import type { AlgorithmTimedResult } from "~/igraph/utils/runIgraphAlgo";

export type EulerianCircuitOutputData<T = string> = {
  algorithm: string;
  hasCircuit?: boolean;
  message?: string;
  path: {
    from: T;
    to: T;
    weight?: number;
  }[];
};

export type EulerianCircuitResult<T = string> = BaseGraphAlgorithmResult & {
  data: EulerianCircuitOutputData<T>;
};

function _parseResult(
  IgraphToKuzu: Map<number, string>,
  nodesMap: Map<string, GraphNode>,
  algorithmResult: EulerianCircuitResult<number>
): EulerianCircuitResult {
  const { mapLabelBack, mapIdBack } = createMapIdBack(IgraphToKuzu, nodesMap);

  const { data, mode, colorMap = {} } = algorithmResult;

  const path = data.path.map(({ from, to, weight }) => ({
    from: mapLabelBack(from),
    to: mapLabelBack(to),
    weight,
  }));

  return {
    mode,
    colorMap: mapColorMapIds(colorMap, mapIdBack),
    data: {
      algorithm: data.algorithm,
      path,
    },
  };
}

export async function igraphEulerianCircuit(
  igraphMod: GraphModule,
  graphData: KuzuToIgraphParseResult
): Promise<AlgorithmTimedResult<EulerianCircuitResult>> {
  return runTimedIgraphAlgorithm(
    igraphMod,
    (m) =>
    m.eulerian_circuit(),
    (wasmResult) =>
      _parseResult(
        graphData.IgraphToKuzuMap,
        graphData.nodesMap,
        wasmResult as EulerianCircuitResult<number>
      )
  );
}
