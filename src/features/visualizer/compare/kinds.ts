import type {
  BaseGraphAlgorithm,
  CompareDescriptor,
  GraphAlgorithmResult,
} from "../algorithms/implementations";
import {
  isAlgorithmVisualizationResult,
  type VisualizationResponse,
} from "../types";

export type CompareKind = "node-score" | "partition";

/** A run being considered for comparison: its result plus the algorithm that produced it. */
export type CompareSubject = {
  response: VisualizationResponse | null | undefined;
  algorithm: BaseGraphAlgorithm | null | undefined;
};

export type NodeScore = {
  node: string;
  score: number;
};

export type PartitionMeta = {
  partitions: string[][];
  modularity?: number;
  quality?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function resultData(
  response: VisualizationResponse | null | undefined
): Record<string, unknown> | null {
  if (!response || !isAlgorithmVisualizationResult(response)) return null;
  if (!("data" in response)) return null;
  const data = (response as GraphAlgorithmResult).data;
  return isRecord(data) ? data : null;
}

/**
 * Descriptors inferred from payload shape for algorithms that have not declared
 * one. The family is derived from the field name so that inference can never
 * pair connectivity components with modularity communities.
 */
const INFERRED_DESCRIPTORS: readonly CompareDescriptor[] = [
  {
    kind: "node-score",
    family: "centrality",
    metric: "centralities",
    dataKey: "centralities",
  },
  {
    kind: "node-score",
    family: "clustering",
    metric: "coefficients",
    dataKey: "coefficients",
  },
  {
    kind: "partition",
    family: "community",
    metric: "communities",
    dataKey: "communities",
  },
  {
    kind: "partition",
    family: "connectivity",
    metric: "components",
    dataKey: "components",
  },
];

/**
 * Prefers the descriptor declared on the algorithm, falling back to payload
 * inference so an algorithm that forgets to declare one still behaves sensibly.
 * Either way the payload must actually be present.
 */
export function getCompareDescriptor(
  subject: CompareSubject
): CompareDescriptor | null {
  const data = resultData(subject.response);
  if (!data) return null;

  const declared = subject.algorithm?.compare;
  if (declared && Array.isArray(data[declared.dataKey])) {
    return declared;
  }

  for (const inferred of INFERRED_DESCRIPTORS) {
    if (Array.isArray(data[inferred.dataKey])) {
      return {
        ...inferred,
        metric: subject.algorithm?.title ?? inferred.metric,
      };
    }
  }
  return null;
}

export function getCompareKind(subject: CompareSubject): CompareKind | null {
  return getCompareDescriptor(subject)?.kind ?? null;
}

export function canCompare(
  previous: CompareSubject,
  current: CompareSubject
): boolean {
  const prev = getCompareDescriptor(previous);
  const curr = getCompareDescriptor(current);
  if (prev == null || curr == null) return false;
  return prev.kind === curr.kind && prev.family === curr.family;
}

/** Raw score deltas only carry meaning when both runs measure the same thing. */
export function isSameMetric(
  previous: CompareSubject,
  current: CompareSubject
): boolean {
  const prev = getCompareDescriptor(previous);
  const curr = getCompareDescriptor(current);
  return prev != null && curr != null && prev.metric === curr.metric;
}

export function extractNodeScores(data: unknown): NodeScore[] {
  if (!isRecord(data)) return [];

  if (Array.isArray(data.centralities)) {
    return data.centralities
      .filter(
        (item): item is { node: string; centrality: number } =>
          isRecord(item) &&
          typeof item.node === "string" &&
          typeof item.centrality === "number"
      )
      .map((item) => ({ node: item.node, score: item.centrality }));
  }

  if (Array.isArray(data.coefficients)) {
    return data.coefficients
      .filter(
        (item): item is { node: string; value: number } =>
          isRecord(item) &&
          typeof item.node === "string" &&
          typeof item.value === "number"
      )
      .map((item) => ({ node: item.node, score: item.value }));
  }

  return [];
}

/**
 * Compare results are keyed by igraph display labels. Resolving them against
 * the live graph both surfaces nodes that no longer exist and yields the Kuzu
 * ids the canvas overlay needs. The map is injected so this module stays free
 * of store dependencies.
 */
export type ResolvedScores = {
  resolved: { id: string; label: string; score: number }[];
  missingLabels: string[];
};

export function resolveScoreNodes(
  scores: NodeScore[],
  labelToId: Map<string, string>
): ResolvedScores {
  const resolved: ResolvedScores["resolved"] = [];
  const missingLabels: string[] = [];

  for (const item of scores) {
    const id = labelToId.get(item.node);
    if (id == null) {
      missingLabels.push(item.node);
      continue;
    }
    resolved.push({ id, label: item.node, score: item.score });
  }

  return { resolved, missingLabels };
}

export type ResolvedPartitions = {
  /** Node ids per community, preserving community order. */
  resolved: string[][];
  missingLabels: string[];
};

export function resolvePartitionNodes(
  meta: PartitionMeta,
  labelToId: Map<string, string>
): ResolvedPartitions {
  const resolved: string[][] = [];
  const missingLabels: string[] = [];

  for (const group of meta.partitions) {
    const ids: string[] = [];
    for (const label of group) {
      const id = labelToId.get(label);
      if (id == null) {
        missingLabels.push(label);
        continue;
      }
      ids.push(id);
    }
    resolved.push(ids);
  }

  return { resolved, missingLabels };
}

export function extractPartitions(data: unknown): PartitionMeta {
  if (!isRecord(data)) return { partitions: [] };

  const raw = Array.isArray(data.communities)
    ? data.communities
    : Array.isArray(data.components)
      ? data.components
      : [];

  const partitions = raw
    .filter((group): group is unknown[] => Array.isArray(group))
    .map((group) =>
      group.filter((node): node is string => typeof node === "string")
    );

  return {
    partitions,
    modularity:
      typeof data.modularity === "number" ? data.modularity : undefined,
    quality: typeof data.quality === "number" ? data.quality : undefined,
  };
}
