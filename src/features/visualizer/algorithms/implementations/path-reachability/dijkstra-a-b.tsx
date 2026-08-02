import { useDynamicRowHeight, type RowComponentProps } from "react-window";
import { ClickableNodeLabel } from "../../components/clickable-node-label";
import { VirtualizedListPanel } from "../../components/virtualized-list-panel";
import { WhatThisMeansSection } from "../../components/what-this-means-section";

import { createGraphAlgorithm, type GraphAlgorithmResult } from "../types";

import { createAlgorithmSelectInput } from "~/features/visualizer/inputs";
import { dijkstraAToBSliceSteps } from "~/features/visualizer/layer-slice";
import type { DijkstraAToBOutputData } from "~/igraph/algorithms/PathFinding/IgraphDijkstraAtoB";

export const dijkstraAToB = createGraphAlgorithm<DijkstraAToBOutputData>({
  title: "Dijkstra (A to B)",
  description: "Finds the shortest path from one node to another",
  inputs: [
    createAlgorithmSelectInput({
      id: "dijkstra-a-to-b-start-node",
      key: "start_node",
      displayName: "Start Node",
      source: "nodes",
      required: true,
    }),
    createAlgorithmSelectInput({
      id: "dijkstra-a-to-b-end-node",
      key: "end_node",
      displayName: "End Node",
      source: "nodes",
      required: true,
    }),
  ],
  wasmFunction: async (igraphController, [arg1, arg2]) => {
    return await igraphController.dijkstraAToB(arg1, arg2);
  },
  output: (props) => <DijkstraAToB {...props} />,
  buildSliceSteps: dijkstraAToBSliceSteps,
});

function DijkstraAToB(props: GraphAlgorithmResult<DijkstraAToBOutputData>) {
  const { source, target, path, totalWeight } = props.data;

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
        ✓ Dijkstra A to B completed successfully
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
          <span className="text-typography-secondary">Total Weight:</span>
          <span className="min-w-0 text-right font-medium text-typography-primary break-words">
            {totalWeight ?? cumulative[path.length - 1] ?? 0}
          </span>
        </div>
      </div>

      {/* Step By Step */}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 border-t border-t-border pt-3 isolate">
        <h3 className="shrink-0 font-semibold">Step By Step</h3>
        {path.length > 0 ? (
          <VirtualizedListPanel
            rowComponent={DijkstraSinglePathRowComponent}
            rowCount={path.length}
            rowHeight={rowHeight}
            rowProps={{ cumulative, path }}
          />
        ) : (
          <p className="text-critical font-medium">Not reachable</p>
        )}
      </div>

      <WhatThisMeansSection>
        <ul className="text-typography-secondary text-sm list-disc list-inside space-y-1">
          <li>
            Dijkstra computes the{" "}
            <span className="font-medium">minimum-weight path</span> from{" "}
            <span className="font-medium">{source}</span> to{" "}
            <span className="font-medium">{target}</span> assuming{" "}
            <span className="font-medium">no negative edges</span>. With
            negative edges, use Bellman-Ford.
          </li>
          <li>
            The “Step by Step” list shows each traversed edge and the{" "}
            <span className="font-medium">cumulative cost</span> after that
            step.
          </li>
          <li>
            <span className="font-medium">Total Weight</span> is the minimal
            cost for reaching the target via the shown path.
          </li>
          <li>
            Minimal weight ≠ minimal hops. Dijkstra optimizes sum of weights.
          </li>
          <li>
            If no path is shown, the target is{" "}
            <span className="font-medium">unreachable</span> from the source.
          </li>
        </ul>
      </WhatThisMeansSection>
    </div>
  );
}

function DijkstraSinglePathRowComponent({
  index,
  style,
  cumulative,
  path: paths,
}: RowComponentProps<{
  cumulative: number[];
  path: DijkstraAToBOutputData["path"];
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
