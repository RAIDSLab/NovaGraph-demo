import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import { useDynamicRowHeight, type RowComponentProps } from "react-window";

import type { ExecuteQueryResult, GraphNode } from "../types";
import { AlgorithmOutputShell } from "../algorithms/components/algorithm-output-shell";
import { AlgorithmStat } from "../algorithms/components/algorithm-stat-grid";
import { ClickableNodeLabel } from "../algorithms/components/clickable-node-label";
import { ResultsSearchInput } from "../algorithms/components/results-search-input";
import { VirtualizedListPanel } from "../algorithms/components/virtualized-list-panel";
import { useStore } from "../hooks/use-store";
import { nodeDisplayLabel } from "../layer-slice";

import {
  parseQueryRows,
  stringifyQueryCell,
  stringifyQueryValue,
  type ClassifiedCell,
  type ParsedQueryRow,
  type ParsedQueryRows,
} from "./parse-query-rows";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import type {
  ErrorQueryResult,
  SuccessQueryResult,
} from "~/kuzu/helpers/KuzuQueryResultExtractor.types";

type ResultViewMode = "table" | "json";

function stringifySafe(v: unknown) {
  return JSON.stringify(
    v,
    (_, val) => (typeof val === "bigint" ? String(val) : val),
    2
  );
}

export default observer(function QueryOutput({
  data,
}: {
  data: ExecuteQueryResult;
}) {
  const { successQueries, failedQueries, success, message } = data;
  const { database } = useStore();
  const nodesMap = database.graph.nodesMap;

  const parsedResults: ParsedQueryRows[] = useMemo(
    () =>
      (successQueries ?? []).map((query: SuccessQueryResult) =>
        parseQueryRows(query.objects)
      ),
    [successQueries]
  );

  const resultRows = parsedResults.reduce(
    (sum, parsed) => sum + parsed.rows.length,
    0
  );
  const uniqueNodeCount = useMemo(() => {
    const ids = new Set<string>();
    for (const parsed of parsedResults) {
      for (const row of parsed.rows) {
        for (const cell of Object.values(row) as ClassifiedCell[]) {
          if (cell.kind === "node") ids.add(cell.kuzuId);
        }
      }
    }
    return ids.size;
  }, [parsedResults]);
  const uniqueEdgeCount = useMemo(() => {
    const keys = new Set<string>();
    for (const parsed of parsedResults) {
      for (const row of parsed.rows) {
        for (const cell of Object.values(row) as ClassifiedCell[]) {
          if (cell.kind === "edge") {
            keys.add(`${cell.sourceId}-${cell.targetId}`);
          }
        }
      }
    }
    return keys.size;
  }, [parsedResults]);

  const failedQueryRowHeight = useDynamicRowHeight({
    defaultRowHeight: 48,
  });

  return (
    <AlgorithmOutputShell
      header={
        <>
          <p
            className={`font-medium text-sm ${
              success ? "text-positive" : "text-critical"
            }`}
          >
            {success ? "✓" : "✗"} {message}
          </p>
          <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            <AlgorithmStat label="Result rows" value={resultRows} />
            <AlgorithmStat label="Result nodes" value={uniqueNodeCount} />
            <AlgorithmStat label="Result edges" value={uniqueEdgeCount} />
            <AlgorithmStat
              label="Graph nodes"
              value={data.nodes?.length || 0}
            />
            <AlgorithmStat
              label="Graph edges"
              value={data.edges?.length || 0}
            />
            <AlgorithmStat
              label="Node schemas"
              value={data.nodeTables?.length || 0}
            />
            <AlgorithmStat
              label="Edge schemas"
              value={data.edgeTables?.length || 0}
            />
          </div>
        </>
      }
      body={
        <div className="flex min-h-0 flex-1 flex-col gap-3 pt-3">
          {failedQueries && failedQueries.length > 0 && (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <h3 className="shrink-0 font-semibold text-critical">
                Failed Queries ({failedQueries.length})
              </h3>
              <VirtualizedListPanel
                rowComponent={FailedQueryRowComponent}
                rowCount={failedQueries.length}
                rowHeight={failedQueryRowHeight}
                rowProps={{ failedQueries }}
              />
            </div>
          )}

          {successQueries && successQueries.length > 0 && (
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              {successQueries.length > 1 && (
                <h3 className="shrink-0 font-semibold text-positive">
                  Success Queries ({successQueries.length})
                </h3>
              )}
              {successQueries.map(
                (query: SuccessQueryResult, index: number) => (
                  <SuccessResultPanel
                    key={index}
                    index={index}
                    query={query}
                    parsed={parsedResults[index]}
                    nodesMap={nodesMap}
                  />
                )
              )}
            </div>
          )}
        </div>
      }
    />
  );
});

function FailedQueryRowComponent({
  index,
  style,
  failedQueries,
}: RowComponentProps<{ failedQueries: ErrorQueryResult[] }>) {
  const query = failedQueries[index];
  return (
    <div
      key={index}
      style={style}
      className="bg-critical/10 border border-critical/20 rounded-md p-3 not-first:pt-4"
    >
      <p className="small-body text-critical">{query.message}</p>
    </div>
  );
}

function SuccessResultPanel({
  index,
  query,
  parsed,
  nodesMap,
}: {
  index: number;
  query: SuccessQueryResult;
  parsed: ReturnType<typeof parseQueryRows>;
  nodesMap: Map<string, GraphNode>;
}) {
  const [viewMode, setViewMode] = useState<ResultViewMode>("table");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setViewMode("table");
    setSearch("");
  }, [query.objects]);

  const filteredRows = useMemo(() => {
    const queryText = search.trim().toLowerCase();
    if (!queryText) return parsed.rows;
    return parsed.rows.filter((row) =>
      parsed.columns.some((column) =>
        stringifyQueryCell(row[column]).toLowerCase().includes(queryText)
      )
    );
  }, [parsed.columns, parsed.rows, search]);

  const rowCountLabel = `${query.objects.length} ${
    query.objects.length === 1 ? "row" : "rows"
  }`;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="font-semibold">
            Result {index + 1}: {rowCountLabel}
          </h3>
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant={viewMode === "table" ? "default" : "ghost"}
              className={cn("h-8")}
              onClick={() => setViewMode("table")}
            >
              Table
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === "json" ? "default" : "ghost"}
              className={cn("h-8")}
              onClick={() => setViewMode("json")}
            >
              Raw JSON
            </Button>
          </div>
        </div>
        {viewMode === "table" && query.objects.length > 0 && (
          <ResultsSearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search results..."
            resultCount={filteredRows.length}
            totalCount={parsed.rows.length}
            className="sm:max-w-64 sm:flex-none"
          />
        )}
      </div>

      {viewMode === "json" ? (
        <div className="min-h-0 flex-1 overflow-auto bg-neutral-low rounded-md p-3">
          <JsonViewer objects={query.objects} />
        </div>
      ) : query.objects.length === 0 ? (
        <p className="text-sm text-typography-secondary">No rows.</p>
      ) : filteredRows.length === 0 ? (
        <p className="text-sm text-typography-secondary">
          No rows match your search.
        </p>
      ) : (
        <QueryResultTable
          columns={parsed.columns}
          rows={filteredRows}
          nodesMap={nodesMap}
        />
      )}
    </div>
  );
}

function QueryResultTable({
  columns,
  rows,
  nodesMap,
}: {
  columns: string[];
  rows: ParsedQueryRow[];
  nodesMap: Map<string, GraphNode>;
}) {
  const rowHeight = useDynamicRowHeight({
    defaultRowHeight: 48,
  });
  const gridTemplateColumns = `repeat(${Math.max(columns.length, 1)}, minmax(10rem, 1fr))`;

  return (
    <VirtualizedListPanel
      rowComponent={QueryResultRowComponent}
      rowCount={rows.length + 1}
      rowHeight={rowHeight}
      rowProps={{ columns, rows, nodesMap, gridTemplateColumns }}
    />
  );
}

function QueryResultRowComponent({
  index,
  style,
  columns,
  rows,
  nodesMap,
  gridTemplateColumns,
}: RowComponentProps<{
  columns: string[];
  rows: ParsedQueryRow[];
  nodesMap: Map<string, GraphNode>;
  gridTemplateColumns: string;
}>) {
  const gridStyle = { ...style, display: "grid", gridTemplateColumns };

  if (index === 0) {
    return (
      <div className="bg-tabdock" style={gridStyle}>
        {columns.map((column) => (
          <span
            key={column}
            className="font-semibold text-sm px-3 py-1.5 truncate"
          >
            {column}
          </span>
        ))}
      </div>
    );
  }

  const row = rows[index - 1];
  return (
    <div className="not-odd:bg-neutral-low/50" style={gridStyle}>
      {columns.map((column) => (
        <div key={column} className="min-w-0 px-3 py-1.5">
          <QueryCellView cell={row[column]} nodesMap={nodesMap} />
        </div>
      ))}
    </div>
  );
}

function QueryCellView({
  cell,
  nodesMap,
}: {
  cell: ClassifiedCell;
  nodesMap: Map<string, GraphNode>;
}) {
  switch (cell.kind) {
    case "node":
      return (
        <ResolvedNodeLabel
          kuzuId={cell.kuzuId}
          fallbackLabel={cell.label}
          nodesMap={nodesMap}
        />
      );
    case "edge":
      return (
        <div className="flex min-w-0 items-center gap-1">
          <ResolvedNodeLabel
            kuzuId={cell.sourceId}
            nodesMap={nodesMap}
            variant="chip"
          />
          <span className="shrink-0 text-typography-secondary">→</span>
          <ResolvedNodeLabel
            kuzuId={cell.targetId}
            nodesMap={nodesMap}
            variant="chip"
          />
        </div>
      );
    case "scalar": {
      const text = stringifyQueryValue(cell.value);
      return (
        <span className="block truncate" title={text || undefined}>
          {text === "" ? "—" : text}
        </span>
      );
    }
    case "json": {
      const text = stringifyQueryValue(cell.value);
      return (
        <span className="block truncate font-mono text-xs" title={text}>
          {text}
        </span>
      );
    }
  }
}

function ResolvedNodeLabel({
  kuzuId,
  fallbackLabel,
  nodesMap,
  variant = "link",
}: {
  kuzuId: string;
  fallbackLabel?: string;
  nodesMap: Map<string, GraphNode>;
  variant?: "link" | "chip";
}) {
  const node = nodesMap.get(kuzuId);
  if (node) {
    return (
      <ClickableNodeLabel
        label={nodeDisplayLabel(node)}
        variant={variant}
        className={cn(
          "block max-w-full",
          variant === "chip" && "px-1.5 py-0.5 text-xs"
        )}
      />
    );
  }

  const fallback = fallbackLabel ? `${fallbackLabel} ${kuzuId}` : kuzuId;
  return (
    <span className="block truncate text-typography-secondary" title={fallback}>
      {fallback}
    </span>
  );
}

function JsonViewer({ objects }: { objects: unknown[] }) {
  const MAX_SIZE = 100 * 1024; // 100 KB

  const { json, size } = useMemo(() => {
    const json = stringifySafe(objects);
    return { json, size: new Blob([json]).size };
  }, [objects]);

  const openInNewTab = () => {
    const blob = new Blob([stringifySafe(objects)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return size > MAX_SIZE ? (
    <Button variant="link" className="text-xs" size="sm" onClick={openInNewTab}>
      File is too big. Open JSON in new tab.
    </Button>
  ) : (
    <pre className="text-xs text-typography-primary whitespace-pre-wrap break-words">
      {json}
    </pre>
  );
}
