import type {
  BaseGraphAlgorithmResult,
  GraphModule,
  KuzuToIgraphParseResult,
} from "../../types";
import { createMapIdBack, mapColorMapIds } from "../../utils/mapIdBack";

import type { GraphNode } from "~/features/visualizer/types";
import { runTimedIgraphAlgorithm } from "~/igraph/utils/runIgraphAlgo";
import type { AlgorithmTimedResult } from "~/igraph/utils/runIgraphAlgo";

export type KCoreOutputData<T = string> = {
  algorithm: string;
  k: number;
  max_coreness: number; // max over all vertices
  cores: T[];
};

export type KCoreResult<T = string> = BaseGraphAlgorithmResult & {
  data: KCoreOutputData<T>;
};

function _parseResult(
  IgraphToKuzu: Map<number, string>,
  nodesMap: Map<string, GraphNode>,
  algorithmResult: KCoreResult<number>
): KCoreResult {
  const { mapIdBack, mapLabelBack } = createMapIdBack(IgraphToKuzu, nodesMap);

  const { data, mode, colorMap = {} } = algorithmResult;

  return {
    mode,
    colorMap: mapColorMapIds(colorMap, mapIdBack),
    data: {
      algorithm: data.algorithm,
      k: data.k,
      max_coreness: data.max_coreness,
      cores: data.cores.map((core) => mapLabelBack(core)),
    },
  };
}

export async function igraphKCore(
  igraphMod: GraphModule,
  graphData: KuzuToIgraphParseResult,
  k: number
): Promise<AlgorithmTimedResult<KCoreResult>> {
  return runTimedIgraphAlgorithm(
    igraphMod,
    (m) => m.k_core(k),
    (wasmResult) =>
      _parseResult(
        graphData.IgraphToKuzuMap,
        graphData.nodesMap,
        wasmResult as KCoreResult<number>
      )
  );
}
