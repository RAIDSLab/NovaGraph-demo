import type {
  BaseGraphAlgorithmResult,
  GraphModule,
  KuzuToIgraphParseResult,
} from "../../types";
import { createMapIdBack, mapColorMapIds } from "../../utils/mapIdBack";

import type { GraphNode } from "~/features/visualizer/types";
import { runTimedIgraphAlgorithm } from "~/igraph/utils/runIgraphAlgo";
import type { AlgorithmTimedResult } from "~/igraph/utils/runIgraphAlgo";

export type WCCOutputData<T = string> = {
  algorithm: string;
  components: T[][]; // index = component id, value = node-name[]
};

export type WCCResult<T = string> = BaseGraphAlgorithmResult & {
  data: WCCOutputData<T>;
};

function _parseResult(
  IgraphToKuzu: Map<number, string>,
  nodesMap: Map<string, GraphNode>,
  algorithmResult: WCCResult<number>
): WCCResult {
  const { mapIdBack, mapLabelBack } = createMapIdBack(IgraphToKuzu, nodesMap);

  const { data, mode, colorMap = {} } = algorithmResult;

  return {
    mode,
    colorMap: mapColorMapIds(colorMap, mapIdBack),
    data: {
      algorithm: data.algorithm,
      components: data.components.map((componentGroup) =>
        componentGroup.map((component) => mapLabelBack(component))
      ),
    },
  };
}

export async function igraphWeaklyConnectedComponents(
  igraphMod: GraphModule,
  graphData: KuzuToIgraphParseResult
): Promise<AlgorithmTimedResult<WCCResult>> {
  return runTimedIgraphAlgorithm(
    igraphMod,
    (m) =>
    m.weakly_connected_components(),
    (wasmResult) =>
      _parseResult(
        graphData.IgraphToKuzuMap,
        graphData.nodesMap,
        wasmResult
      )
  );
}
