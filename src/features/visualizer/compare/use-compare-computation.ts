import { useMemo } from "react";

import type { BaseGraphAlgorithm } from "../algorithms/implementations";
import { buildLabelToIdMap } from "../layer-slice";
import type { GraphNode, VisualizationResponse } from "../types";

import {
  agreedPartitionNodes,
  buildNodeScoreDiffOverlay,
  buildPartitionDiffOverlay,
  missingScoreLabels,
  type DiffOverlay,
} from "./diff-overlay";
import {
  canCompare,
  extractNodeScores,
  extractPartitions,
  getCompareDescriptor,
  isSameMetric,
  resultData,
  type CompareKind,
  type CompareSubject,
} from "./kinds";
import { compareNodeScores, type NodeScoreCompareResult } from "./node-score";
import { comparePartitions, type PartitionCompareResult } from "./partition";

export type CompareComputation = {
  kind: CompareKind;
  /** Raw score deltas are only shown when both runs measure the same thing. */
  sameMetric: boolean;
  nodeScore: NodeScoreCompareResult | null;
  partition: PartitionCompareResult | null;
  diff: DiffOverlay;
};

export type CompareInput = {
  previousResponse: VisualizationResponse | null | undefined;
  previousAlgorithm: BaseGraphAlgorithm | null | undefined;
  currentResponse: VisualizationResponse | null | undefined;
  currentAlgorithm: BaseGraphAlgorithm | null | undefined;
  nodes: GraphNode[];
};

function computeCompare(input: CompareInput): CompareComputation | null {
  const previous: CompareSubject = {
    response: input.previousResponse,
    algorithm: input.previousAlgorithm,
  };
  const current: CompareSubject = {
    response: input.currentResponse,
    algorithm: input.currentAlgorithm,
  };

  if (!canCompare(previous, current)) return null;

  const descriptor = getCompareDescriptor(current);
  if (!descriptor) return null;

  const prevData = resultData(previous.response);
  const currData = resultData(current.response);
  if (!prevData || !currData) return null;

  const labelToId = buildLabelToIdMap(input.nodes);

  if (descriptor.kind === "node-score") {
    const prevScores = extractNodeScores(prevData);
    const currScores = extractNodeScores(currData);
    const nodeScore = compareNodeScores(prevScores, currScores);
    const diff = buildNodeScoreDiffOverlay(nodeScore, labelToId);
    // Baseline-only labels never reach the diff rows' resolution path.
    diff.missingLabels.push(...missingScoreLabels(prevScores, labelToId));

    return {
      kind: "node-score",
      sameMetric: isSameMetric(previous, current),
      nodeScore,
      partition: null,
      diff: {
        ...diff,
        missingLabels: [...new Set(diff.missingLabels)],
      },
    };
  }

  const prevPartitions = extractPartitions(prevData);
  const partition = comparePartitions(
    prevPartitions,
    extractPartitions(currData)
  );
  const diff = buildPartitionDiffOverlay(
    partition,
    agreedPartitionNodes(prevPartitions.partitions, partition),
    labelToId
  );

  return {
    kind: "partition",
    sameMetric: isSameMetric(previous, current),
    nodeScore: null,
    partition,
    diff: {
      ...diff,
      missingLabels: [...new Set(diff.missingLabels)],
    },
  };
}

/**
 * Shared by the compare panel and the canvas overlay so both read the same
 * numbers. Recomputed only when a run or the node set changes.
 */
export function useCompareComputation(
  input: CompareInput
): CompareComputation | null {
  const {
    previousResponse,
    previousAlgorithm,
    currentResponse,
    currentAlgorithm,
    nodes,
  } = input;

  return useMemo(
    () =>
      computeCompare({
        previousResponse,
        previousAlgorithm,
        currentResponse,
        currentAlgorithm,
        nodes,
      }),
    [
      previousResponse,
      previousAlgorithm,
      currentResponse,
      currentAlgorithm,
      nodes,
    ]
  );
}
