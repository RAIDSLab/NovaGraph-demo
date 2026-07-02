import { useState } from "react";
import { useDynamicRowHeight, type RowComponentProps } from "react-window";
import { VirtualizedListPanel } from "../../components/virtualized-list-panel";
import { WhatThisMeansSection } from "../../components/what-this-means-section";

import { createGraphAlgorithm, type GraphAlgorithmResult } from "../types";

import InputComponent, {
  createEmptyInputResult,
  createSwitchInput,
} from "~/features/visualizer/inputs";
import type { MinimalSpanningTreeOutputData } from "~/igraph/algorithms/PathFinding/IgraphMST";

export const mst = createGraphAlgorithm<MinimalSpanningTreeOutputData>({
  title: "Minimum Spanning Tree",
  description:
    "Finds the subset of edges that connects all nodes in the graph with the minimum possible total edge weight.",
  inputs: [],
  wasmFunction: async (igraphController, _) => {
    return await igraphController.minimumSpanningTree();
  },
  output: (props) => <MinimalSpanningTree {...props} />,
});

function MinimalSpanningTree(
  props: GraphAlgorithmResult<MinimalSpanningTreeOutputData>
) {
  const { weighted, maxEdges, totalWeight, edges } = props.data;

  const rowHeight = useDynamicRowHeight({
    defaultRowHeight: 48,
  });

  const showWeightsInput = createSwitchInput({
    id: "mst-show-weights",
    key: "show_weights",
    displayName: "Show Weights",
    defaultValue: weighted ?? false,
    disabled: !weighted,
    showLabel: false,
  });

  const [showWeight, setShowWeight] = useState(
    createEmptyInputResult(showWeightsInput)
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="shrink-0 space-y-2">
        <p className="font-medium text-sm text-positive">
        ✓ Minimum Spanning Tree completed successfully
      </p>

      {/* Statistics */}
      <div className="flex flex-col gap-1.5 text-sm">
        <div className="flex items-start justify-between gap-4">
          <span className="text-typography-secondary">
            Number of Edges Selected:
          </span>
          <span className="min-w-0 text-right font-medium text-typography-primary break-words">
            {edges.length}
          </span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <span className="text-typography-secondary">
            Maximum Number of Edges:
          </span>
          <span className="min-w-0 text-right font-medium text-typography-primary break-words">
            {maxEdges}
          </span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <span className="text-typography-secondary">Total Weight:</span>
          <span className="min-w-0 text-right font-medium text-typography-primary break-words">
            {totalWeight ?? edges.length - 1}
          </span>
        </div>
      </div>

      {/* Edges */}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 border-t border-t-border pt-3 isolate">
        <div className="flex items-center justify-between">
          <h3 className="shrink-0 font-semibold">Minimum Spanning Tree Edges</h3>
          <div className="flex gap-2">
            <span className="text-sm">Show Weight:</span>
            <InputComponent
              input={showWeightsInput}
              value={showWeight.value}
              onChange={setShowWeight}
            />
          </div>
        </div>
        <VirtualizedListPanel
            rowComponent={MSTEdgeRowComponent}
            rowCount={edges.length + 1} // Top header row
            rowHeight={rowHeight}
            rowProps={{ showWeight: showWeight.value ?? false, edges }}
          />
      </div>

      <WhatThisMeansSection>
        <ul className="text-typography-secondary text-sm list-disc list-inside space-y-1">
          <li>
            The Minimum Spanning Tree connects{" "}
            <span className="font-medium">all reachable nodes</span> with
            <span className="font-medium"> no cycles</span> and the{" "}
            <span className="font-medium">smallest possible total weight</span>{" "}
            (for weighted graphs).
          </li>
          <li>
            MST is defined for <span className="font-medium">undirected</span>{" "}
            graphs.
          </li>
          <li>
            The list shows the exact set of edges chosen. With weights shown,
            the
            <span className="font-medium"> Total Weight</span> is the sum over
            these edges; when hidden/unweighted, each edge counts as cost{" "}
            <span className="font-medium">1</span>.
          </li>
          <li>
            In a connected undirected graph with <i>V</i> nodes, an MST has{" "}
            <span className="font-medium">V − 1 edges</span>. If fewer edges
            appear, the graph is{" "}
            <span className="font-medium">disconnected</span>.
          </li>
          <li>
            There can be{" "}
            <span className="font-medium">multiple valid MSTs</span> if
            different edge sets have the same total weight.
          </li>
          <li>
            MSTs are useful for{" "}
            <span className="font-medium">backbone design</span> (networks,
            roads, wiring) and for removing redundancy while keeping the graph
            connected.
          </li>
        </ul>
      </WhatThisMeansSection>
    </div>
  );
}

function MSTEdgeRowComponent({
  index,
  style,
  showWeight,
  edges,
}: RowComponentProps<{
  showWeight: boolean;
  edges: MinimalSpanningTreeOutputData["edges"];
}>) {
  // Top header row
  if (index === 0) {
    return (
      <div
        key={index}
        className="bg-tabdock grid grid-flow-col auto-cols-fr"
        style={style}
      >
        <span className="font-semibold text-sm px-3 py-1.5">No.</span>
        <span className="font-semibold text-sm px-3 py-1.5">From</span>
        <span className="font-semibold text-sm px-3 py-1.5">To</span>
        {showWeight && (
          <span className="font-semibold text-sm px-3 py-1.5">Weight</span>
        )}
      </div>
    );
  }

  const edge = edges[index - 1];
  return (
    <div
      key={index}
      className="grid grid-flow-col auto-cols-fr not-odd:bg-neutral-low/50"
      style={style}
    >
      <span className="px-3 py-1.5">{edge.num}</span>
      <span className="px-3 py-1.5 truncate">{edge.from}</span>
      <span className="px-3 py-1.5 truncate">{edge.to}</span>
      {showWeight && (
        <span className="px-3 py-1.5">{edge.weight?.toFixed(2)}</span>
      )}
    </div>
  );
}
