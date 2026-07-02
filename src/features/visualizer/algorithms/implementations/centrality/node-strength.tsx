import { useDynamicRowHeight, type RowComponentProps } from "react-window";
import { VirtualizedListPanel } from "../../components/virtualized-list-panel";
import { WhatThisMeansSection } from "../../components/what-this-means-section";

import { createGraphAlgorithm, type GraphAlgorithmResult } from "../types";

import type { StrengthCentralityOutputData } from "~/igraph/algorithms/Centrality/IgraphStrengthCentrality";

export const nodeStrengthCentrality =
  createGraphAlgorithm<StrengthCentralityOutputData>({
    title: "Node Strength",
    description:
      "Measures the sum of the weights of the edges connected to a node.",
    inputs: [],
    wasmFunction: async (igraphController, _) => {
      return await igraphController.strengthCentrality();
    },
    output: (props) => <NodeStrengthCentrality {...props} />,
  });

function NodeStrengthCentrality(
  props: GraphAlgorithmResult<StrengthCentralityOutputData>
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
        ✓ Node Strength Centrality completed successfully
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
            rowComponent={NodeStrengthCentralityRowComponent}
            rowCount={sortedCentralities.length + 1} // Top header row
            rowHeight={rowHeight}
            rowProps={{ centralities: sortedCentralities }}
          />
      </div>

      <WhatThisMeansSection>
        <ul className="text-typography-secondary text-sm list-disc list-inside space-y-1">
          <li>
            Node strength is the{" "}
            <span className="font-medium">sum of weights</span> of edges
            incident to a node, a weighted analogue of degree.
          </li>
          <li>
            Higher values indicate nodes with{" "}
            <span className="font-medium">many and/or heavy</span> connections
            (e.g., capacity, bandwidth, interaction volume).
          </li>
          <li>
            Top node is{" "}
            <span className="font-medium">{sortedCentralities[0]?.node}</span>{" "}
            with centrality of
            <span className="font-medium">
              {" "}
              {sortedCentralities[0]?.centrality.toFixed(2)}
            </span>
            .
          </li>
          <li>
            If your graph is unweighted, strength reduces to degree (each edge
            weight = 1).
          </li>
          <li>
            Good for ranking nodes by{" "}
            <span className="font-medium">aggregate connectivity</span> where
            edge weights matter.
          </li>
        </ul>
      </WhatThisMeansSection>
    </div>
  );
}

function NodeStrengthCentralityRowComponent({
  index,
  style,
  centralities,
}: RowComponentProps<{
  centralities: StrengthCentralityOutputData["centralities"];
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
