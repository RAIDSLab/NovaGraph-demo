import { useDynamicRowHeight, type RowComponentProps } from "react-window";
import { VirtualizedListPanel } from "../../components/virtualized-list-panel";
import { WhatThisMeansSection } from "../../components/what-this-means-section";

import { createGraphAlgorithm, type GraphAlgorithmResult } from "../types";

import type { DegreeCentralityOutputData } from "~/igraph/algorithms/Centrality/IgraphDegreeCentrality";

export const degreeCentrality =
  createGraphAlgorithm<DegreeCentralityOutputData>({
    title: "Degree Centrality",
    description: "Measures the number of edges connected to a node.",
    inputs: [],
    wasmFunction: async (igraphController, _) => {
      return await igraphController.degreeCentrality();
    },
    output: (props) => <DegreeCentrality {...props} />,
  });

function DegreeCentrality(
  props: GraphAlgorithmResult<DegreeCentralityOutputData>
) {
  const { centralities } = props.data;

  const rowHeight = useDynamicRowHeight({
    defaultRowHeight: 48,
  });

  const sortedCentralities = centralities.sort(
    (c1, c2) => c2.centrality - c1.centrality
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="shrink-0 space-y-2">
        <p className="font-medium text-sm text-positive">
        ✓ Degree Centrality completed successfully
      </p>

      {/* Statistics */}
      {centralities.length > 0 && (
        <div className="flex flex-col gap-1.5 text-sm">
          <div className="flex items-start justify-between gap-4">
            <span className="text-typography-secondary">
              Most Central Node:
            </span>
            <span className="min-w-0 text-right font-medium text-typography-primary break-words">
              {sortedCentralities[0].node}
            </span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <span className="text-typography-secondary">
              Max Centrality Score:
            </span>
            <span className="min-w-0 text-right font-medium text-typography-primary break-words">
              {sortedCentralities[0].centrality.toFixed(2)}
            </span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <span className="text-typography-secondary">Nodes Analyzed:</span>
            <span className="min-w-0 text-right font-medium text-typography-primary break-words">
              {sortedCentralities.length}
            </span>
          </div>
        </div>
      )}

      {/* Centralities */}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 border-t border-t-border pt-3 isolate">
        <h3 className="shrink-0 font-semibold">Centralities</h3>
        <VirtualizedListPanel
            rowComponent={DegreeCentralityRowComponent}
            rowCount={sortedCentralities.length + 1} // Top header row
            rowHeight={rowHeight}
            rowProps={{ centralities: sortedCentralities }}
          />
      </div>

      <WhatThisMeansSection>
        <ul className="text-typography-secondary text-sm list-disc list-inside space-y-1">
          <li>
            Degree centrality counts how many{" "}
            <span className="font-medium">edges</span> touch a node, a direct
            measure of its immediate connectivity.
          </li>
          <li>
            Higher values indicate nodes with many neighbors (potential hubs).
            In directed graphs, degree may be split into{" "}
            <span className="font-medium">in-/out-degree</span> depending on
            settings.
          </li>
          <li>
            <span className="font-medium">{sortedCentralities[0]?.node}</span>{" "}
            has the highest degree (
            <span className="font-medium">
              {sortedCentralities[0]?.centrality.toFixed(2)}
            </span>
            ).
          </li>
          <li>
            This metric ignores edge weights. For weighted connectivity, see{" "}
            <span className="font-medium">Node Strength</span>.
          </li>
          <li>
            Useful for spotting <span className="font-medium">local hubs</span>,
            but it doesn’t account for who those neighbors are.
          </li>
        </ul>
      </WhatThisMeansSection>
    </div>
  );
}

function DegreeCentralityRowComponent({
  index,
  style,
  centralities,
}: RowComponentProps<{
  centralities: DegreeCentralityOutputData["centralities"];
}>) {
  // Top header row
  if (index === 0) {
    return (
      <div
        key={index}
        className="bg-tabdock grid grid-flow-col auto-cols-fr"
        style={style}
      >
        <span className="font-semibold text-sm px-3 py-1.5">Rank</span>
        <span className="font-semibold text-sm px-3 py-1.5">Node</span>
        <span className="font-semibold text-sm px-3 py-1.5">Centrality</span>
      </div>
    );
  }

  const centrality = centralities[index - 1];
  return (
    <div
      key={index}
      className="grid grid-flow-col auto-cols-fr not-odd:bg-neutral-low/50"
      style={style}
    >
      <span className="px-3 py-1.5">{index}</span>
      <span className="px-3 py-1.5 truncate">{centrality.node}</span>
      <span className="px-3 py-1.5 truncate">
        {centrality.centrality.toFixed(2)}
      </span>
    </div>
  );
}
