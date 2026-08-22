import { useMemo, useState } from "react";
import { useDynamicRowHeight, type RowComponentProps } from "react-window";

import { ClickableNodeLabel } from "../algorithms/components/clickable-node-label";
import { ResultsSearchInput } from "../algorithms/components/results-search-input";
import { VirtualizedListPanel } from "../algorithms/components/virtualized-list-panel";
import type { GraphAlgorithmResult } from "../algorithms/implementations";
import type { PreviousAlgorithmRun } from "../store";

import {
  canCompare,
  extractNodeScores,
  extractPartitions,
  getCompareKind,
} from "./kinds";
import {
  compareNodeScores,
  type NodeScoreDiffRow,
} from "./node-score";
import {
  comparePartitions,
  type PartitionDisagreement,
} from "./partition";

function formatSigned(value: number | null, digits = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  const formatted = value.toFixed(digits);
  return value > 0 ? `+${formatted}` : formatted;
}

function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

export function ComparePanel({
  previousRun,
  currentResponse,
  currentTitle,
}: {
  previousRun: PreviousAlgorithmRun;
  currentResponse: GraphAlgorithmResult;
  currentTitle: string;
}) {
  if (!canCompare(previousRun.response, currentResponse)) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-typography-secondary">
        Previous result is a different type and cannot be compared with the
        current run.
      </div>
    );
  }

  const kind = getCompareKind(currentResponse);

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
              {previousRun.title}
            </span>
          </span>
          <span>
            Current:{" "}
            <span className="font-medium text-typography-primary">
              {currentTitle}
            </span>
          </span>
        </div>
      </div>

      {kind === "node-score" ? (
        <NodeScoreCompareView
          previousData={previousRun.response.data}
          currentData={currentResponse.data}
        />
      ) : (
        <PartitionCompareView
          previousData={previousRun.response.data}
          currentData={currentResponse.data}
        />
      )}
    </div>
  );
}

function NodeScoreCompareView({
  previousData,
  currentData,
}: {
  previousData: unknown;
  currentData: unknown;
}) {
  const [search, setSearch] = useState("");
  const rowHeight = useDynamicRowHeight({ defaultRowHeight: 44 });

  const result = useMemo(
    () =>
      compareNodeScores(
        extractNodeScores(previousData),
        extractNodeScores(currentData)
      ),
    [previousData, currentData]
  );

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
            summary.topK > 0
              ? `${summary.topKOverlap}/${summary.topK}`
              : "—"
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
                  .map((row) => row.node.split(" ")[0])
                  .join(", ")
          }
        />
      </div>

      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-semibold">Score differences</h3>
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
          rowProps={{ rows: filtered }}
        />
      )}
    </div>
  );
}

function NodeScoreDiffRowView({
  index,
  style,
  rows,
}: RowComponentProps<{ rows: NodeScoreDiffRow[] }>) {
  if (index === 0) {
    return (
      <div
        className="bg-tabdock grid grid-cols-7 gap-1 text-xs font-semibold sm:text-sm"
        style={style}
      >
        <span className="px-2 py-1.5">Node</span>
        <span className="px-2 py-1.5">Rank⁻</span>
        <span className="px-2 py-1.5">Rank⁺</span>
        <span className="px-2 py-1.5">ΔRank</span>
        <span className="px-2 py-1.5">Score⁻</span>
        <span className="px-2 py-1.5">Score⁺</span>
        <span className="px-2 py-1.5">ΔScore</span>
      </div>
    );
  }

  const row = rows[index - 1];
  return (
    <div
      className="grid grid-cols-7 gap-1 text-xs not-odd:bg-neutral-low/50 sm:text-sm"
      style={style}
    >
      <span className="min-w-0 px-2 py-1.5">
        <ClickableNodeLabel label={row.node} className="block w-full" />
      </span>
      <span className="px-2 py-1.5 tabular-nums">{row.prevRank ?? "—"}</span>
      <span className="px-2 py-1.5 tabular-nums">{row.currRank ?? "—"}</span>
      <span className="px-2 py-1.5 tabular-nums">
        {row.rankDelta == null
          ? "—"
          : row.rankDelta > 0
            ? `+${row.rankDelta}`
            : String(row.rankDelta)}
      </span>
      <span className="px-2 py-1.5 tabular-nums">
        {formatNumber(row.prevScore, 4)}
      </span>
      <span className="px-2 py-1.5 tabular-nums">
        {formatNumber(row.currScore, 4)}
      </span>
      <span className="px-2 py-1.5 tabular-nums">
        {formatSigned(row.scoreDelta, 4)}
      </span>
    </div>
  );
}

function PartitionCompareView({
  previousData,
  currentData,
}: {
  previousData: unknown;
  currentData: unknown;
}) {
  const [search, setSearch] = useState("");
  const rowHeight = useDynamicRowHeight({ defaultRowHeight: 40 });

  const result = useMemo(
    () =>
      comparePartitions(
        extractPartitions(previousData),
        extractPartitions(currentData)
      ),
    [previousData, currentData]
  );

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
        <Stat
          label="Membership agreement"
          value={`${formatNumber(result.agreementPercent, 1)}% (${result.agreedCount}/${result.totalCompared})`}
        />
        <Stat
          label="Communities"
          value={`${result.prevCommunityCount} → ${result.currCommunityCount}`}
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

function PartitionDisagreeRowView({
  index,
  style,
  rows,
}: RowComponentProps<{ rows: PartitionDisagreement[] }>) {
  if (index === 0) {
    return (
      <div
        className="bg-tabdock grid grid-cols-3 text-sm font-semibold"
        style={style}
      >
        <span className="px-3 py-1.5">Node</span>
        <span className="px-3 py-1.5">Prev community</span>
        <span className="px-3 py-1.5">Curr community</span>
      </div>
    );
  }

  const row = rows[index - 1];
  return (
    <div
      className="grid grid-cols-3 text-sm not-odd:bg-neutral-low/50"
      style={style}
    >
      <span className="min-w-0 px-3 py-1.5">
        <ClickableNodeLabel label={row.node} className="block w-full" />
      </span>
      <span className="px-3 py-1.5 tabular-nums">{row.prevCommunity + 1}</span>
      <span className="px-3 py-1.5 tabular-nums">{row.currCommunity + 1}</span>
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
