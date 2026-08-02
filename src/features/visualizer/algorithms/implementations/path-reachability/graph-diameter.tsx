import { useDynamicRowHeight, type RowComponentProps } from "react-window";
import { ClickableNodeLabel } from "../../components/clickable-node-label";
import { VirtualizedListPanel } from "../../components/virtualized-list-panel";
import { WhatThisMeansSection } from "../../components/what-this-means-section";

import { createGraphAlgorithm, type GraphAlgorithmResult } from "../types";

import type { GraphDiameterOutputData } from "~/igraph/algorithms/Misc/IgraphDiameter";
import { graphDiameterSliceSteps } from "~/features/visualizer/layer-slice";

export const graphDiameter = createGraphAlgorithm<GraphDiameterOutputData>({
  title: "Graph Diameter",
  description: "Calculates the longest shortest path between any two nodes.",
  inputs: [],
  wasmFunction: async (igraphController, _) => {
    return await igraphController.graphDiameter();
  },
  output: (props) => <GraphDiameter {...props} />,
  buildSliceSteps: graphDiameterSliceSteps,
});

function GraphDiameter(props: GraphAlgorithmResult<GraphDiameterOutputData>) {
  const { source, target, diameter, path } = props.data;

  const rowHeight = useDynamicRowHeight({
    defaultRowHeight: 48,
  });

  const cumulative = path.reduce<number[]>((acc, step, i) => {
    const prev = acc[i - 1] ?? 0;
    acc.push(prev + (step.weight ?? 1));
    return acc;
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="shrink-0 space-y-2">
        <p className="font-medium text-sm text-positive">
        ✓ Graph Diameter completed successfully
      </p>

      {/* Statistics */}
      <div className="flex flex-col gap-1.5 text-sm">
        <div className="flex items-start justify-between gap-4">
          <span className="text-typography-secondary">Source:</span>
          <span className="min-w-0 text-right font-medium text-typography-primary break-words">{source}</span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <span className="text-typography-secondary">Target:</span>
          <span className="min-w-0 text-right font-medium text-typography-primary break-words">{target}</span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <span className="text-typography-secondary">
            Diameter/Total Weight:
          </span>
          <span className="min-w-0 text-right font-medium text-typography-primary break-words">
            {diameter ?? cumulative[path.length - 1]}
          </span>
        </div>
      </div>

      {/* Step By Step */}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 border-t border-t-border pt-3 isolate">
        <h3 className="shrink-0 font-semibold">Step By Step</h3>
        <VirtualizedListPanel
            rowComponent={GraphDiameterPathRowComponent}
            rowCount={path.length}
            rowHeight={rowHeight}
            rowProps={{ cumulative, path }}
          />
      </div>

      <WhatThisMeansSection>
        <ul className="text-typography-secondary text-sm list-disc list-inside space-y-1">
          <li>
            The graph diameter is the length of the{" "}
            <span className="font-medium">longest shortest path</span> between
            any two nodes.
          </li>
          <li>
            The pair shown (<span className="font-medium">{source}</span> →{" "}
            <span className="font-medium">{target}</span>) achieves this
            diameter, with the listed{" "}
            <span className="font-medium">shortest-path sequence</span>.
          </li>
          <li>
            The reported value (<span className="font-medium">{diameter}</span>{" "}
            or total cumulative weight) is the{" "}
            <span className="font-medium">distance</span> of that path.
          </li>
          <li>
            Interpretation: a larger diameter suggests{" "}
            <span className="font-medium">sparser or more elongated</span>{" "}
            connectivity; a smaller one indicates a more{" "}
            <span className="font-medium">compact</span> network.
          </li>
          <li>
            In weighted graphs, diameter reflects{" "}
            <span className="font-medium">cost/delay</span>; in unweighted
            graphs, it counts <span className="font-medium">hops</span>.
          </li>
        </ul>
      </WhatThisMeansSection>
    </div>
  );
}

function GraphDiameterPathRowComponent({
  index,
  style,
  cumulative,
  path: paths,
}: RowComponentProps<{
  cumulative: number[];
  path: GraphDiameterOutputData["path"];
}>) {
  const path = paths[index];
  return (
    <div key={index} style={style}>
      <div className="border border-border rounded-md px-4 py-3 space-y-1 mb-2">
        <div className="grid grid-cols-[36px_1fr_auto] gap-4">
          {/* Step number */}
          <p className="text-sm font-semibold">{index + 1}</p>

          {/* Source to Target */}
          <div className="min-w-0 overflow-hidden">
            <div className="flex items-center gap-2 h-full">
              <ClickableNodeLabel
                label={path.from}
                variant="chip"
                className="max-w-1/2 text-sm truncate whitespace-nowrap"
              />
              <span className="shrink-0">→</span>
              <ClickableNodeLabel
                label={path.to}
                variant="chip"
                className="max-w-1/2 text-sm truncate whitespace-nowrap"
              />
            </div>
          </div>

          {/* Weight */}
          <div className="text-right">
            <p className="font-semibold">+{path.weight ?? 1}</p>
            <p className="text-xs text-typography-secondary">Step weight</p>
          </div>
        </div>

        {/* Cumulative */}
        <p className="text-xs text-typography-secondary">
          Cumulative: {cumulative[index - 1] ?? 0} + {path.weight ?? 1} ={" "}
          <b>{cumulative[index]}</b>
        </p>
      </div>
    </div>
  );
}
