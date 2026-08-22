import { resolveScoreNodes } from "./kinds";
import type { NodeScoreCompareResult } from "./node-score";
import type { PartitionCompareResult } from "./partition";

export type DiffCategory = "up" | "down" | "stable" | "changed" | "missing";

export const DIFF_CATEGORIES: readonly DiffCategory[] = [
  "up",
  "down",
  "changed",
  "stable",
  "missing",
];

export const DIFF_CATEGORY_LABELS: Record<DiffCategory, string> = {
  up: "Moved up",
  down: "Moved down",
  changed: "Changed community",
  stable: "Unchanged",
  missing: "Only in one run",
};

/** Keyed by Kuzu node id, which is what the renderer indexes nodes by. */
export type DiffCategories = Record<string, DiffCategory>;

export type DiffOverlay = {
  categories: DiffCategories;
  counts: Record<DiffCategory, number>;
  /** Labels from the compare result that no longer exist in the graph. */
  missingLabels: string[];
};

/**
 * Rank movement smaller than this share of the population is treated as noise
 * rather than a real shift, so a large graph does not light up entirely.
 */
const RANK_MOVE_FRACTION = 0.05;

export function rankMoveThreshold(nodeCount: number): number {
  return Math.max(1, Math.ceil(nodeCount * RANK_MOVE_FRACTION));
}

const emptyCounts = (): Record<DiffCategory, number> => ({
  up: 0,
  down: 0,
  stable: 0,
  changed: 0,
  missing: 0,
});

function assign(
  overlay: DiffOverlay,
  id: string,
  category: DiffCategory
): void {
  overlay.categories[id] = category;
  overlay.counts[category] += 1;
}

export function buildNodeScoreDiffOverlay(
  result: NodeScoreCompareResult,
  labelToId: Map<string, string>
): DiffOverlay {
  const overlay: DiffOverlay = {
    categories: {},
    counts: emptyCounts(),
    missingLabels: [],
  };
  const threshold = rankMoveThreshold(result.summary.nodeCount);

  for (const row of result.rows) {
    const id = labelToId.get(row.node);
    if (id == null) {
      overlay.missingLabels.push(row.node);
      continue;
    }

    if (row.rankDelta == null) {
      assign(overlay, id, "missing");
      continue;
    }
    // rankDelta is prevRank - currRank, so a positive value means the node
    // climbed toward rank 1.
    if (row.rankDelta >= threshold) {
      assign(overlay, id, "up");
    } else if (row.rankDelta <= -threshold) {
      assign(overlay, id, "down");
    } else {
      assign(overlay, id, "stable");
    }
  }

  return overlay;
}

export function buildPartitionDiffOverlay(
  result: PartitionCompareResult,
  agreedNodes: Iterable<string>,
  labelToId: Map<string, string>
): DiffOverlay {
  const overlay: DiffOverlay = {
    categories: {},
    counts: emptyCounts(),
    missingLabels: [],
  };

  for (const label of agreedNodes) {
    const id = labelToId.get(label);
    if (id == null) {
      overlay.missingLabels.push(label);
      continue;
    }
    assign(overlay, id, "stable");
  }

  for (const row of result.disagreements) {
    const id = labelToId.get(row.node);
    if (id == null) {
      overlay.missingLabels.push(row.node);
      continue;
    }
    assign(overlay, id, row.changeType === "vanished" ? "missing" : "changed");
  }

  return overlay;
}

/**
 * Agreeing nodes are not enumerated by `comparePartitions` (only disagreements
 * are), so recover them by subtracting the disagreements from the baseline.
 */
export function agreedPartitionNodes(
  previousPartitions: string[][],
  result: PartitionCompareResult
): string[] {
  const disagreeing = new Set(result.disagreements.map((row) => row.node));
  const agreed: string[] = [];
  for (const group of previousPartitions) {
    for (const node of group) {
      if (!disagreeing.has(node)) agreed.push(node);
    }
  }
  return agreed;
}

/** Labels in a score result that are no longer present in the graph. */
export function missingScoreLabels(
  scores: { node: string; score: number }[],
  labelToId: Map<string, string>
): string[] {
  return resolveScoreNodes(scores, labelToId).missingLabels;
}
