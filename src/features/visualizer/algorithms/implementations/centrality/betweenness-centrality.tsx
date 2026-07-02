import { useDynamicRowHeight, type RowComponentProps } from "react-window";
import { VirtualizedListPanel } from "../../components/virtualized-list-panel";
import { WhatThisMeansSection } from "../../components/what-this-means-section";

import { createGraphAlgorithm, type GraphAlgorithmResult } from "../types";

import type { BetweennessCentralityOutputData } from "~/igraph/algorithms/Centrality/IgraphBetweenessCentrality";

export const betweennessCentrality =
  createGraphAlgorithm<BetweennessCentralityOutputData>({
    title: "Betweenness Centrality",
    description:
      "Count how often a node lies on shortest paths between others.",
    inputs: [],
    wasmFunction: async (igraphController, _) => {
      return await igraphController.betweennessCentrality();
    },
    output: (props) => <BetweennessCentrality {...props} />,
  });

function BetweennessCentrality(
  props: GraphAlgorithmResult<BetweennessCentralityOutputData>
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
        ✓ Betweenness Centrality completed successfully
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
            rowComponent={BetweennessCentralityRowComponent}
            rowCount={sortedCentralities.length + 1} // Top header row
            rowHeight={rowHeight}
            rowProps={{ centralities: sortedCentralities }}
          />
      </div>

      <WhatThisMeansSection>
        <ul className="text-typography-secondary text-sm list-disc list-inside space-y-1">
          <li>
            Betweenness centrality counts how often a node lies on{" "}
            <span className="font-medium">
              shortest paths between other pairs
            </span>{" "}
            - a proxy for being a{" "}
            <span className="font-medium">bridge / broker</span> in the network.
          </li>
          {sortedCentralities.length > 0 && (
            <li>
              <span className="font-medium">{sortedCentralities[0].node}</span>{" "}
              has the highest score (
              <span className="font-medium">
                {sortedCentralities[0].centrality.toFixed(2)}
              </span>
              ), meaning many shortest paths pass through it compared to others.
            </li>
          )}
          <li>
            In weighted graphs, “shortest” uses edge weights; in unweighted
            graphs it uses hops.
          </li>
        </ul>
      </WhatThisMeansSection>
    </div>
  );
}

function BetweennessCentralityRowComponent({
  index,
  style,
  centralities,
}: RowComponentProps<{
  centralities: BetweennessCentralityOutputData["centralities"];
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
