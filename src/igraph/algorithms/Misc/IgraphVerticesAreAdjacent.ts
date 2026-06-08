import type {
  BaseGraphAlgorithmResult,
  GraphModule,
  KuzuToIgraphParseResult,
} from "../../types";
import { createMapIdBack, mapColorMapIds } from "../../utils/mapIdBack";

import type { GraphNode } from "~/features/visualizer/types";
import { runTimedIgraphAlgorithm } from "~/igraph/utils/runIgraphAlgo";
import type { AlgorithmTimedResult } from "~/igraph/utils/runIgraphAlgo";

export type VerticesAreAdjacentOutputData<T = string> = {
  algorithm: string;
  source: T;
  target: T;
  adjacent: boolean;
  weight?: number; // only if edge exists AND weights present
};

export type VerticesAreAdjacentResult<T = string> = BaseGraphAlgorithmResult & {
  data: VerticesAreAdjacentOutputData<T>;
};

function _parseResult(
  IgraphToKuzu: Map<number, string>,
  nodesMap: Map<string, GraphNode>,
  algorithmResult: VerticesAreAdjacentResult<number>
): VerticesAreAdjacentResult {
  const { mapIdBack, mapLabelBack } = createMapIdBack(IgraphToKuzu, nodesMap);

  const { data, mode, colorMap = {} } = algorithmResult;

  return {
    mode,
    colorMap: mapColorMapIds(colorMap, mapIdBack),
    data: {
      algorithm: data.algorithm,
      source: mapLabelBack(data.source),
      target: mapLabelBack(data.target),
      adjacent: data.adjacent,
      weight: data.weight,
    },
  };
}

export async function igraphVerticesAreAdjacent(
  igraphMod: GraphModule,
  graphData: KuzuToIgraphParseResult,
  kuzuSourceID: string,
  kuzuTargetID: string
): Promise<AlgorithmTimedResult<VerticesAreAdjacentResult>> {
  const sourceIgraphId = graphData.KuzuToIgraphMap.get(kuzuSourceID);
  const targetIgraphId = graphData.KuzuToIgraphMap.get(kuzuTargetID);

  if (sourceIgraphId == null || targetIgraphId == null) {
    throw new Error(
      `Source node "${kuzuSourceID}" or target node "${kuzuTargetID}" not found in graph data`
    );
  }

  return runTimedIgraphAlgorithm(
    igraphMod,
    (m) =>
    m.vertices_are_adjacent(sourceIgraphId, targetIgraphId),
    (wasmResult) =>
      _parseResult(
        graphData.IgraphToKuzuMap,
        graphData.nodesMap,
        wasmResult as VerticesAreAdjacentResult<number>
      )
  );
}
