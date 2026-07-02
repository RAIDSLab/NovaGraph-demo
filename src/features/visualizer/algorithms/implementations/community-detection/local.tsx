import { useDynamicRowHeight, type RowComponentProps } from "react-window";
import { VirtualizedListPanel } from "../../components/virtualized-list-panel";
import { WhatThisMeansSection } from "../../components/what-this-means-section";

import { createGraphAlgorithm, type GraphAlgorithmResult } from "../types";

import type { LocalClusteringCoefficientOutputData } from "~/igraph/algorithms/Community/IgraphLocalClusteringCoefficient";

export const localClusteringCoefficient =
  createGraphAlgorithm<LocalClusteringCoefficientOutputData>({
    title: "Local Clustering Coefficient",
    description:
      "Measures the number of triangles that pass through a node. Any nodes with a clustering coefficient of 0 are not part of any triangles.",
    inputs: [],
    wasmFunction: async (igraphController, _) => {
      return await igraphController.localClusteringCoefficient();
    },
    output: (props) => <LocalClusteringCoefficient {...props} />,
  });

function LocalClusteringCoefficient(
  props: GraphAlgorithmResult<LocalClusteringCoefficientOutputData>
) {
  const { global_coefficient, coefficients } = props.data;

  const rowHeight = useDynamicRowHeight({
    defaultRowHeight: 48,
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="shrink-0 space-y-2">
        <p className="font-medium text-sm text-positive">
        ✓ Local Clustering Coefficient completed successfully
      </p>

      {/* Statistics */}
      <div className="flex flex-col gap-1.5 text-sm">
        <div className="flex items-start justify-between gap-4">
          <span className="text-typography-secondary">Global Coefficient:</span>
          <span className="min-w-0 text-right font-medium text-typography-primary break-words">
            {global_coefficient.toFixed(2)}
          </span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <span className="text-typography-secondary">Nodes Analyzed:</span>
          <span className="min-w-0 text-right font-medium text-typography-primary break-words">
            {coefficients.length}
          </span>
        </div>
      </div>

      {/* Coefficients */}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 border-t border-t-border pt-3 isolate">
        <h3 className="shrink-0 font-semibold">Coefficients</h3>
        {/* Rows */}
        <VirtualizedListPanel
            rowComponent={LocalClusteringCoefficientRowComponent}
            rowCount={coefficients.length + 1} // Top header row
            rowHeight={rowHeight}
            rowProps={{ coefficients }}
          />
      </div>

      <WhatThisMeansSection>
        <ul className="text-typography-secondary text-sm list-disc list-inside space-y-1">
          <li>
            A node's local clustering coefficient measures how many{" "}
            <span className="font-medium">triangles</span> it participates in
            relative to how many could exist among its neighbors (range 0-1).
          </li>
          <li>
            The table lists each node's coefficient;{" "}
            <span className="font-medium">higher values</span> mean the node
            sits in a tightly knit neighborhood.
          </li>
          <li>
            <span className="font-medium">
              Global coefficient = {global_coefficient.toFixed(2)}
            </span>{" "}
            is the average across nodes (ignoring undefined cases), indicating
            overall triangle density.
          </li>
          <li>
            Use cases: spotting{" "}
            <span className="font-medium">cluster hubs</span>, measuring local
            cohesion, and comparing triangle-rich vs sparse regions.
          </li>
        </ul>
      </WhatThisMeansSection>
    </div>
  );
}

function LocalClusteringCoefficientRowComponent({
  index,
  style,
  coefficients,
}: RowComponentProps<{
  coefficients: LocalClusteringCoefficientOutputData["coefficients"];
}>) {
  // Top header row
  if (index === 0) {
    return (
      <div key={index} className="grid grid-cols-2 bg-tabdock" style={style}>
        <span className="font-semibold text-sm px-3 py-1.5">Node</span>
        <span className="font-semibold text-sm px-3 py-1.5">Coefficient</span>
      </div>
    );
  }

  const coefficient = coefficients[index - 1];
  return (
    <div
      key={index}
      className="grid grid-cols-2 not-odd:bg-neutral-low/50"
      style={style}
    >
      {/* Layer Index */}
      <span className="px-3 py-1.5">{coefficient.node}</span>
      <span className="px-3 py-1.5">{coefficient.value.toFixed(2)}</span>
    </div>
  );
}
