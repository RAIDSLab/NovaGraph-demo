import { downloadFile } from "../export/utils";

import type { CompareComputation } from "./use-compare-computation";

const escapeCell = (value: string | number | null): string => {
  if (value == null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const toCsv = (header: string[], rows: (string | number | null)[][]): string =>
  [header, ...rows].map((row) => row.map(escapeCell).join(",")).join("\n");

/** Filesystem-safe slug so the two run titles stay readable in the filename. */
const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "run";

export function exportCompareDiffCsv(
  computation: CompareComputation,
  baselineTitle: string,
  currentTitle: string
): void {
  const filename = `compare-${slugify(baselineTitle)}-vs-${slugify(currentTitle)}.csv`;

  if (computation.kind === "node-score" && computation.nodeScore) {
    const csv = toCsv(
      [
        "node",
        "prev_rank",
        "curr_rank",
        "rank_delta",
        "prev_score",
        "curr_score",
        "score_delta",
        "prev_percentile",
        "curr_percentile",
        "percentile_delta",
      ],
      computation.nodeScore.rows.map((row) => [
        row.node,
        row.prevRank,
        row.currRank,
        row.rankDelta,
        row.prevScore,
        row.currScore,
        row.scoreDelta,
        row.prevPercentile,
        row.currPercentile,
        row.percentileDelta,
      ])
    );
    downloadFile(csv, filename, "text/csv;charset=utf-8");
    return;
  }

  if (computation.partition) {
    const csv = toCsv(
      ["node", "prev_community", "curr_community", "change_type"],
      computation.partition.disagreements.map((row) => [
        row.node,
        row.prevCommunity + 1,
        row.currCommunity < 0 ? null : row.currCommunity + 1,
        row.changeType,
      ])
    );
    downloadFile(csv, filename, "text/csv;charset=utf-8");
  }
}
