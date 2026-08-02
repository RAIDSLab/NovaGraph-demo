import { useMemo, useState } from "react";
import { useDynamicRowHeight, type RowComponentProps } from "react-window";

import { ClickableNodeLabel } from "./clickable-node-label";
import { ResultsSearchInput } from "./results-search-input";
import { VirtualizedListPanel } from "./virtualized-list-panel";

export type NodeScoreItem = {
  node: string;
  score: number;
};

type RankedItem = NodeScoreItem & { rank: number };

export function NodeScoreResultsPanel({
  items,
  title,
  scoreHeader = "Score",
  showRank = true,
  formatScore = (score: number) => score.toFixed(2),
  searchPlaceholder = "Search nodes...",
}: {
  items: NodeScoreItem[];
  title: string;
  scoreHeader?: string;
  showRank?: boolean;
  formatScore?: (score: number) => string;
  searchPlaceholder?: string;
}) {
  const [search, setSearch] = useState("");

  const rowHeight = useDynamicRowHeight({
    defaultRowHeight: 48,
  });

  const ranked = useMemo<RankedItem[]>(() => {
    const sorted = [...items].sort((a, b) => b.score - a.score);
    return sorted.map((item, index) => ({ ...item, rank: index + 1 }));
  }, [items]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return ranked;
    return ranked.filter((item) => item.node.toLowerCase().includes(query));
  }, [ranked, search]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 border-t border-t-border pt-3 isolate">
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="shrink-0 font-semibold">{title}</h3>
        <ResultsSearchInput
          value={search}
          onChange={setSearch}
          placeholder={searchPlaceholder}
          resultCount={filtered.length}
          totalCount={ranked.length}
          className="sm:max-w-64 sm:flex-none"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-typography-secondary">
          {ranked.length === 0 ? "No results." : "No nodes match your search."}
        </p>
      ) : (
        <VirtualizedListPanel
          rowComponent={NodeScoreRow}
          rowCount={filtered.length + 1}
          rowHeight={rowHeight}
          rowProps={{
            items: filtered,
            showRank,
            scoreHeader,
            formatScore,
          }}
        />
      )}
    </div>
  );
}

function NodeScoreRow({
  index,
  style,
  items,
  showRank,
  scoreHeader,
  formatScore,
}: RowComponentProps<{
  items: RankedItem[];
  showRank: boolean;
  scoreHeader: string;
  formatScore: (score: number) => string;
}>) {
  const gridClass = showRank
    ? "grid grid-flow-col auto-cols-fr"
    : "grid grid-cols-2";

  if (index === 0) {
    return (
      <div key={index} className={`bg-tabdock ${gridClass}`} style={style}>
        {showRank && (
          <span className="font-semibold text-sm px-3 py-1.5">Rank</span>
        )}
        <span className="font-semibold text-sm px-3 py-1.5">Node</span>
        <span className="font-semibold text-sm px-3 py-1.5">{scoreHeader}</span>
      </div>
    );
  }

  const item = items[index - 1];
  return (
    <div
      key={index}
      className={`${gridClass} not-odd:bg-neutral-low/50`}
      style={style}
    >
      {showRank && <span className="px-3 py-1.5">{item.rank}</span>}
      <span className="min-w-0 px-3 py-1.5">
        <ClickableNodeLabel label={item.node} className="block w-full" />
      </span>
      <span className="px-3 py-1.5 truncate">{formatScore(item.score)}</span>
    </div>
  );
}
