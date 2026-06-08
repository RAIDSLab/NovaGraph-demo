import type {
  BaseGraphAlgorithmResult,
  GraphModule,
  KuzuToIgraphParseResult,
} from "../../types";
import { createMapIdBack, mapColorMapIds } from "../../utils/mapIdBack";

import { _parseCentralities, type CentralityItem } from "./util";

import { runTimedIgraphAlgorithm } from "~/igraph/utils/runIgraphAlgo";
import type { AlgorithmTimedResult } from "~/igraph/utils/runIgraphAlgo";
import type { GraphNode } from "~/features/visualizer/types";

export type HarmonicCentralityOutputData<T = string> = {
  algorithm: string;
  centralities: CentralityItem<T>[];
};

export type HarmonicCentralityResult<T = string> = BaseGraphAlgorithmResult & {
  data: HarmonicCentralityOutputData<T>;
};

function _parseResult(
  IgraphToKuzu: Map<number, string>,
  nodesMap: Map<string, GraphNode>,
  algorithmResult: HarmonicCentralityResult<number>
): HarmonicCentralityResult {
  const { mapIdBack, mapLabelBack } = createMapIdBack(IgraphToKuzu, nodesMap);

  const { data, mode, colorMap = {}, sizeMap = {} } = algorithmResult;

  return {
    mode,
    colorMap: mapColorMapIds(colorMap, mapIdBack),
    sizeMap: mapColorMapIds(sizeMap, mapIdBack),
    data: {
      algorithm: data.algorithm,
      centralities: _parseCentralities(data.centralities, mapLabelBack),
    },
  };
}

export async function igraphHarmonicCentrality(
  igraphMod: GraphModule,
  graphData: KuzuToIgraphParseResult
): Promise<AlgorithmTimedResult<HarmonicCentralityResult>> {
  return runTimedIgraphAlgorithm(
    igraphMod,
    (m) =>
    m.harmonic_centrality(),
    (wasmResult) =>
      _parseResult(
        graphData.IgraphToKuzuMap,
        graphData.nodesMap,
        wasmResult as HarmonicCentralityResult<number>
      )
  );
}
