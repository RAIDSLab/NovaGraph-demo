import { useMemo, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { useDynamicRowHeight, type RowComponentProps } from "react-window";

import { ClickableNodeLabel } from "../algorithms/components/clickable-node-label";
import { ResultsSearchInput } from "../algorithms/components/results-search-input";
import { VirtualizedListPanel } from "../algorithms/components/virtualized-list-panel";
import type {
  BaseGraphAlgorithm,
  GraphAlgorithmResult,
} from "../algorithms/implementations";
import { runDisplayTitle } from "../algorithms/param-label";
import { DIFF_CATEGORY_CSS } from "../renderer/lib/color-lut";
import type { PreviousAlgorithmRun } from "../store";
import type { GraphNode } from "../types";

import {
  DIFF_CATEGORIES,
  DIFF_CATEGORY_LABELS,
  type DiffOverlay,
} from "./diff-overlay";
import { shortNodeLabel } from "./labels";
import type { NodeScoreCompareResult, NodeScoreDiffRow } from "./node-score";
import type {
  PartitionCompareResult,
  PartitionDisagreement,
} from "./partition";
import { useCompareComputation } from "./use-compare-computation";

function formatSigned(value: number | null, digits = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  const formatted = value.toFixed(digits);
  return value > 0 ? `+${formatted}` : formatted;
}

function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

function formatRank(value: number | null): string {
  if (value == null) return "—";
  // Tied nodes carry a fractional average rank.
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatPercent(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(0)}%`;
}

function formatSignedPercent(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  const points = value * 100;
  const formatted = points.toFixed(0);
  return points > 0 ? `+${formatted}pp` : `${formatted}pp`;
}

export function ComparePanel({
  baseline,
  currentResponse,
  currentAlgorithm,
  currentTitle,
  currentParamLabel,
  nodes,
  graphRevision,
  diffHighlight,
}: {
  baseline: PreviousAlgorithmRun;
  currentResponse: GraphAlgorithmResult;
  currentAlgorithm: BaseGraphAlgorithm | null;
  currentTitle: string;
  currentParamLabel: string;
  nodes: GraphNode[];
  graphRevision: number;
  diffHighlight: boolean;
}) {
  const computation = useCompareComputation({
    previousResponse: baseline.response,
    previousAlgorithm: baseline.algorithm,
    currentResponse,
    currentAlgorithm,
    nodes,
  });

  if (!computation) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-typography-secondary">
        Previous result is a different type and cannot be compared with the
        current run.
      </div>
    );
  }

  const isStale = baseline.graphRevision !== graphRevision;
  const { diff } = computation;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="shrink-0 space-y-1">
        <p className="font-medium text-sm text-typography-primary">
          Compare: previous vs current
        </p>
        <div className="flex flex-col gap-0.5 text-sm text-typography-secondary sm:flex-row sm:gap-4">
          <span>
            Previous:{" "}
            <span className="font-medium text-typography-primary">
              {runDisplayTitle(baseline.title, baseline.paramLabel)}
            </span>
          </span>
          <span>
            Current:{" "}
            <span className="font-medium text-typography-primary">
              {runDisplayTitle(currentTitle, currentParamLabel)}
            </span>
          </span>
        </div>
      </div>

      {isStale && (
        <div className="flex shrink-0 items-start gap-2 rounded-md border border-critical/40 bg-critical/10 px-3 py-2 text-sm text-typography-primary">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-critical" />
          <span>
            The graph changed after the previous run, so differences below may
            reflect the edit rather than the algorithms.
          </span>
        </div>
      )}

      {diff.missingLabels.length > 0 && (
        <p className="shrink-0 text-sm text-typography-secondary">
          {diff.missingLabels.length} node
          {diff.missingLabels.length === 1 ? "" : "s"} from these results are no
          longer in the graph and are excluded from the canvas highlight.
        </p>
      )}

      {diffHighlight && <DiffLegend diff={diff} />}

      {computation.kind === "node-score" && computation.nodeScore ? (
        <NodeScoreCompareView
          result={computation.nodeScore}
          showRawScoreDelta={computation.sameMetric}
        />
      ) : computation.partition ? (
        <PartitionCompareView result={computation.partition} />
      ) : null}
    </div>
  );
}

function DiffLegend({ diff }: { diff: DiffOverlay }) {
  const present = DIFF_CATEGORIES.filter(
    (category) => diff.counts[category] > 0
  );
  if (present.length === 0) return null;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-typography-secondary">
      <span className="font-medium">Canvas:</span>
      {present.map((category) => (
        <span key={category} className="flex items-center gap-1.5">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: DIFF_CATEGORY_CSS[category] }}
          />
          {DIFF_CATEGORY_LABELS[category]} ({diff.counts[category]})
        </span>
      ))}
    </div>
  );
}

function NodeScoreCompareView({
  result,
  showRawScoreDelta,
}: {
  result: NodeScoreCompareResult;
  showRawScoreDelta: boolean;
}) {
  const [search, setSearch] = useState("");
  const rowHeight = useDynamicRowHeight({ defaultRowHeight: 44 });

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return result.rows;
    return result.rows.filter((row) => row.node.toLowerCase().includes(query));
  }, [result.rows, search]);

  const { summary } = result;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="shrink-0 grid gap-1.5 text-sm sm:grid-cols-2">
        <Stat
          label="Shared nodes"
          value={`${summary.sharedCount}/${summary.nodeCount}`}
        />
        <Stat
          label={`Top-${summary.topK} overlap`}
          value={
            summary.topK > 0 ? `${summary.topKOverlap}/${summary.topK}` : "—"
          }
        />
        <Stat
          label="Spearman (ranks)"
          value={formatNumber(summary.spearman, 3)}
        />
        <Stat
          label="Biggest rank movers"
          value={
            summary.biggestMovers.length === 0
              ? "—"
              : summary.biggestMovers
                  .slice(0, 3)
                  .map((row) => shortNodeLabel(row.node))
                  .join(", ")
          }
        />
      </div>

      {!showRawScoreDelta && (
        <p className="shrink-0 text-xs text-typography-secondary">
          These runs measure different metrics, so scores are shown as
          percentiles within each run rather than as a raw difference.
        </p>
      )}

      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-semibold">
          {showRawScoreDelta ? "Score differences" : "Rank differences"}
        </h3>
        <ResultsSearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search nodes..."
          resultCount={filtered.length}
          totalCount={result.rows.length}
          className="sm:max-w-64 sm:flex-none"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-typography-secondary">
          No nodes match your search.
        </p>
      ) : (
        <VirtualizedListPanel
          rowComponent={NodeScoreDiffRowView}
          rowCount={filtered.length + 1}
          rowHeight={rowHeight}
          rowProps={{ rows: filtered, showRawScoreDelta }}
        />
      )}
    </div>
  );
}

/** Narrow viewports keep only the node and the two deltas. */
const SCORE_GRID = "grid grid-cols-3 gap-1 sm:grid-cols-7";
const SCORE_NARROW_HIDDEN = "hidden px-2 py-1.5 sm:block";

function NodeScoreDiffRowView({
  index,
  style,
  rows,
  showRawScoreDelta,
}: RowComponentProps<{
  rows: NodeScoreDiffRow[];
  showRawScoreDelta: boolean;
}>) {
  if (index === 0) {
    return (
      <div
        className={`bg-tabdock ${SCORE_GRID} text-xs font-semibold sm:text-sm`}
        style={style}
      >
        <span className="px-2 py-1.5">Node</span>
        <span className={SCORE_NARROW_HIDDEN}>Rank⁻</span>
        <span className={SCORE_NARROW_HIDDEN}>Rank⁺</span>
        <span className="px-2 py-1.5">ΔRank</span>
        <span className={SCORE_NARROW_HIDDEN}>
          {showRawScoreDelta ? "Score⁻" : "Pct⁻"}
        </span>
        <span className={SCORE_NARROW_HIDDEN}>
          {showRawScoreDelta ? "Score⁺" : "Pct⁺"}
        </span>
        <span className="px-2 py-1.5">
          {showRawScoreDelta ? "ΔScore" : "ΔPct"}
        </span>
      </div>
    );
  }

  const row = rows[index - 1];
  return (
    <div
      className={`${SCORE_GRID} text-xs not-odd:bg-neutral-low/50 sm:text-sm`}
      style={style}
    >
      <span className="min-w-0 px-2 py-1.5">
        <ClickableNodeLabel label={row.node} className="block w-full" />
      </span>
      <span className={`${SCORE_NARROW_HIDDEN} tabular-nums`}>
        {formatRank(row.prevRank)}
      </span>
      <span className={`${SCORE_NARROW_HIDDEN} tabular-nums`}>
        {formatRank(row.currRank)}
      </span>
      <span className="px-2 py-1.5 tabular-nums">
        {row.rankDelta == null
          ? "—"
          : row.rankDelta > 0
            ? `+${formatRank(row.rankDelta)}`
            : formatRank(row.rankDelta)}
      </span>
      <span className={`${SCORE_NARROW_HIDDEN} tabular-nums`}>
        {showRawScoreDelta
          ? formatNumber(row.prevScore, 4)
          : formatPercent(row.prevPercentile)}
      </span>
      <span className={`${SCORE_NARROW_HIDDEN} tabular-nums`}>
        {showRawScoreDelta
          ? formatNumber(row.currScore, 4)
          : formatPercent(row.currPercentile)}
      </span>
      <span className="px-2 py-1.5 tabular-nums">
        {showRawScoreDelta
          ? formatSigned(row.scoreDelta, 4)
          : formatSignedPercent(row.percentileDelta)}
      </span>
    </div>
  );
}

function PartitionCompareView({ result }: { result: PartitionCompareResult }) {
  const [search, setSearch] = useState("");
  const rowHeight = useDynamicRowHeight({ defaultRowHeight: 40 });

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return result.disagreements;
    return result.disagreements.filter((row) =>
      row.node.toLowerCase().includes(query)
    );
  }, [result.disagreements, search]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="shrink-0 grid gap-1.5 text-sm sm:grid-cols-2">
        <Stat label="ARI" value={formatNumber(result.ari, 3)} />
        <Stat label="NMI" value={formatNumber(result.nmi, 3)} />
        <Stat
          label="Communities"
          value={`${result.prevCommunityCount} → ${result.currCommunityCount}`}
        />
        <Stat
          label="Membership agreement"
          value={`${formatNumber(result.agreementPercent, 1)}% (${result.agreedCount}/${result.totalCompared})`}
        />
        <Stat
          label="Modularity"
          value={`${formatNumber(result.prevModularity)} → ${formatNumber(result.currModularity)}`}
        />
        <Stat
          label="Quality"
          value={`${formatNumber(result.prevQuality)} → ${formatNumber(result.currQuality)}`}
        />
      </div>

      <p className="shrink-0 text-xs text-typography-secondary">
        ARI and NMI compare the two partitions without pairing communities, so
        neither is penalised by relabelling.
      </p>

      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-semibold">
          Disagreeing nodes ({result.disagreements.length})
        </h3>
        <ResultsSearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search nodes..."
          resultCount={filtered.length}
          totalCount={result.disagreements.length}
          className="sm:max-w-64 sm:flex-none"
        />
      </div>

      {result.disagreements.length === 0 ? (
        <p className="text-sm text-typography-secondary">
          All compared nodes agree after community matching.
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-typography-secondary">
          No nodes match your search.
        </p>
      ) : (
        <VirtualizedListPanel
          rowComponent={PartitionDisagreeRowView}
          rowCount={filtered.length + 1}
          rowHeight={rowHeight}
          rowProps={{ rows: filtered }}
        />
      )}
    </div>
  );
}

const PARTITION_GRID = "grid grid-cols-2 sm:grid-cols-4";
const PARTITION_NARROW_HIDDEN = "hidden px-3 py-1.5 sm:block";

const CHANGE_TYPE_LABELS: Record<PartitionDisagreement["changeType"], string> =
  {
    moved: "Moved",
    split: "Split",
    merged: "Merged",
    vanished: "Gone",
  };

function PartitionDisagreeRowView({
  index,
  style,
  rows,
}: RowComponentProps<{ rows: PartitionDisagreement[] }>) {
  if (index === 0) {
    return (
      <div
        className={`bg-tabdock ${PARTITION_GRID} text-sm font-semibold`}
        style={style}
      >
        <span className="px-3 py-1.5">Node</span>
        <span className={PARTITION_NARROW_HIDDEN}>Prev community</span>
        <span className={PARTITION_NARROW_HIDDEN}>Curr community</span>
        <span className="px-3 py-1.5">Change</span>
      </div>
    );
  }

  const row = rows[index - 1];
  return (
    <div
      className={`${PARTITION_GRID} text-sm not-odd:bg-neutral-low/50`}
      style={style}
    >
      <span className="min-w-0 px-3 py-1.5">
        <ClickableNodeLabel label={row.node} className="block w-full" />
      </span>
      <span className={`${PARTITION_NARROW_HIDDEN} tabular-nums`}>
        {row.prevCommunity + 1}
      </span>
      <span className={`${PARTITION_NARROW_HIDDEN} tabular-nums`}>
        {row.currCommunity < 0 ? "—" : row.currCommunity + 1}
      </span>
      <span className="px-3 py-1.5">{CHANGE_TYPE_LABELS[row.changeType]}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-typography-secondary">{label}</span>
      <span className="min-w-0 text-right font-medium text-typography-primary break-words">
        {value}
      </span>
    </div>
  );
}
