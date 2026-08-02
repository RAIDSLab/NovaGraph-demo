import { useDynamicRowHeight, type RowComponentProps } from "react-window";
import { ClickableNodeLabel } from "../../components/clickable-node-label";
import { ResultsSearchInput } from "../../components/results-search-input";
import { VirtualizedListPanel } from "../../components/virtualized-list-panel";
import { WhatThisMeansSection } from "../../components/what-this-means-section";
import { useMemo, useState } from "react";

import { createGraphAlgorithm, type GraphAlgorithmResult } from "../types";

import InputComponent, {
  createAlgorithmSelectInput,
  createEmptyInputResult,
  createSwitchInput,
} from "~/features/visualizer/inputs";
import { dijkstraAToAllSliceSteps } from "~/features/visualizer/layer-slice";
import type { DijkstraAToAllOutputData } from "~/igraph/algorithms/PathFinding/IgraphDijkstraAtoAll";

export const dijkstraAToAll = createGraphAlgorithm<DijkstraAToAllOutputData>({
  title: "Dijkstra (A to All)",
  description: "Finds the shortest path from one node to all other nodes",
  inputs: [
    createAlgorithmSelectInput({
      id: "dijkstra-a-to-all-start-node",
      key: "start_node",
      displayName: "Start Node",
      source: "nodes",
      required: true,
    }),
  ],
  wasmFunction: async (igraphController, [arg1]) => {
    return await igraphController.dijkstraAToAll(arg1);
  },
  output: (props) => <DijkstraAToAll {...props} />,
  buildSliceSteps: dijkstraAToAllSliceSteps,
});

function DijkstraAToAll(props: GraphAlgorithmResult<DijkstraAToAllOutputData>) {
  const { source, weighted, paths } = props.data;
  const [search, setSearch] = useState("");

  const rowHeight = useDynamicRowHeight({
    defaultRowHeight: 48,
  });

  const showWeightsInput = createSwitchInput({
    id: "dijkstra-show-weights",
    key: "show_weights",
    displayName: "Show Weights",
    defaultValue: weighted ?? false,
    disabled: !weighted,
    showLabel: false,
  });

  const [showWeight, setShowWeight] = useState(
    createEmptyInputResult(showWeightsInput)
  );

  const filteredPaths = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return paths;
    return paths.filter(
      (path) =>
        path.target.toLowerCase().includes(query) ||
        path.path.some((node) => node.toLowerCase().includes(query))
    );
  }, [paths, search]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <p className="font-medium text-sm text-positive">
        ✓ Dijkstra A to All completed successfully
      </p>

      {/* Statistics */}
      <p className="text-sm text-typography-secondary">
        Source: <ClickableNodeLabel label={source} variant="inline" />
      </p>

      {/* Paths */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 border-t border-t-border pt-3 isolate">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="shrink-0 font-semibold">Traversal Paths</h3>
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-3">
            <ResultsSearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search targets..."
              resultCount={filteredPaths.length}
              totalCount={paths.length}
              className="sm:max-w-56 sm:flex-none"
            />
            <div className="flex items-center gap-2">
              <span className="text-sm">Show Weight:</span>
              <InputComponent
                input={showWeightsInput}
                value={showWeight.value}
                onChange={setShowWeight}
              />
            </div>
          </div>
        </div>
        {filteredPaths.length === 0 ? (
          <p className="text-sm text-typography-secondary">
            No paths match your search.
          </p>
        ) : (
          <VirtualizedListPanel
            rowComponent={DijkstraSingleSourcePathRowComponent}
            rowCount={filteredPaths.length + 1}
            rowHeight={rowHeight}
            rowProps={{
              showWeight: showWeight.value ?? false,
              paths: filteredPaths,
            }}
          />
        )}
      </div>

      <WhatThisMeansSection>
        <ul className="text-typography-secondary text-sm list-disc list-inside space-y-1">
          <li>
            Dijkstra computes the{" "}
            <span className="font-medium">minimum-weight path</span> from{" "}
            <span className="font-medium">{source}</span> to{" "}
            <span className="font-medium">every reachable node</span>, assuming{" "}
            <span className="font-medium">no negative edges</span>. With
            negative edges, use Bellman-Ford.
          </li>
          <li>
            Each row shows a target, its{" "}
            <span className="font-medium">hop count</span>, optional
            <span className="font-medium"> total weight</span>, and the{" "}
            <span className="font-medium">actual shortest-path sequence</span>.
          </li>
          <li>
            “Shortest” refers to{" "}
            <span className="font-medium">lowest total weight</span>, not
            necessarily the fewest hops.
          </li>
          <li>
            If a node doesn’t appear, it’s{" "}
            <span className="font-medium">unreachable</span> from the source
            under current edge directions/weights.
          </li>
        </ul>
      </WhatThisMeansSection>
    </div>
  );
}

function DijkstraSingleSourcePathRowComponent({
  index,
  style,
  showWeight,
  paths,
}: RowComponentProps<{
  showWeight: boolean;
  paths: DijkstraAToAllOutputData["paths"];
}>) {
  // Top header row
  if (index === 0) {
    return (
      <div
        style={style}
        className={`bg-tabdock min-w-0 grid grid-flow-col ${
          showWeight ? "grid-cols-4" : "grid-cols-3"
        }`}
      >
        <span className="font-semibold text-sm px-3 py-1.5">Target</span>
        <span className="font-semibold text-sm px-3 py-1.5">Hops</span>
        {showWeight && (
          <span className="font-semibold text-sm px-3 py-1.5">Weight</span>
        )}
        <span className="font-semibold text-sm px-3 py-1.5">Shortest Path</span>
      </div>
    );
  }

  const path = paths[index - 1];

  return (
    <div
      style={style}
      className={`grid grid-flow-col ${
        showWeight ? "grid-cols-4" : "grid-cols-3"
      } not-odd:bg-neutral-low/50`}
    >
      <ClickableNodeLabel
        label={path.target}
        className="font-semibold px-3 py-1.5"
      />
      <span className="font-semibold px-3 py-1.5">{path.path.length}</span>

      {showWeight && (
        <span className="font-semibold px-3 py-1.5">
          {path.weight !== undefined ? path.weight.toFixed(2) : "—"}
        </span>
      )}

      {/* Nodes */}
      <span
        className={`flex gap-1 overflow-x-auto font-semibold px-3 py-1.5 ${
          showWeight && "col-span-2"
        }`}
      >
        {path.path.map((p, i) => (
          <div key={`${index}-${i}-${p}`} className="flex items-center">
            <ClickableNodeLabel
              label={p}
              variant="chip"
              className="text-nowrap"
            />
            {i < path.path.length - 1 && <span>→</span>}
          </div>
        ))}
      </span>
    </div>
  );
}
