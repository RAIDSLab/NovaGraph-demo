import type { GraphAlgorithmResult } from "../algorithms/implementations";
import {
  isAlgorithmVisualizationResult,
  type VisualizationResponse,
} from "../types";

export type CompareKind = "node-score" | "partition";

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

export function getCompareKind(
  response: VisualizationResponse | null | undefined
): CompareKind | null {
  if (!response || !isAlgorithmVisualizationResult(response)) return null;
  if (!("data" in response)) return null;
  const data = (response as GraphAlgorithmResult).data;
  if (!isRecord(data)) return null;

  if (Array.isArray(data.centralities) || Array.isArray(data.coefficients)) {
    return "node-score";
  }
  if (Array.isArray(data.communities) || Array.isArray(data.components)) {
    return "partition";
  }
  return null;
}

export function canCompare(
  previous: VisualizationResponse | null | undefined,
  current: VisualizationResponse | null | undefined
): boolean {
  const prevKind = getCompareKind(previous);
  const currKind = getCompareKind(current);
  return prevKind != null && prevKind === currKind;
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
