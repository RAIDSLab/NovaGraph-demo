export {
  canCompare,
  extractNodeScores,
  extractPartitions,
  getCompareDescriptor,
  getCompareKind,
  isSameMetric,
  resolvePartitionNodes,
  resolveScoreNodes,
  type CompareKind,
  type CompareSubject,
  type NodeScore,
  type PartitionMeta,
  type ResolvedPartitions,
  type ResolvedScores,
} from "./kinds";
export {
  fractionalRank,
  rankCorrelation,
  rankPercentile,
  type RankedNodeScore,
} from "./rank";
export {
  compareNodeScores,
  type NodeScoreCompareResult,
  type NodeScoreDiffRow,
} from "./node-score";
export {
  comparePartitions,
  type PartitionChangeType,
  type PartitionCompareResult,
  type PartitionDisagreement,
} from "./partition";
export {
  adjustedRandIndex,
  buildContingency,
  normalizedMutualInformation,
  type Contingency,
  type Membership,
} from "./metrics";
export {
  DIFF_CATEGORIES,
  DIFF_CATEGORY_LABELS,
  buildNodeScoreDiffOverlay,
  buildPartitionDiffOverlay,
  type DiffCategories,
  type DiffCategory,
  type DiffOverlay,
} from "./diff-overlay";
export {
  useCompareComputation,
  type CompareComputation,
} from "./use-compare-computation";
export { exportCompareDiffCsv } from "./export-diff";
export { shortNodeLabel } from "./labels";
export { ComparePanel } from "./compare-panel";
