import { useDynamicRowHeight, type RowComponentProps } from "react-window";
import { ClickableNodeLabel } from "../../components/clickable-node-label";
import { VirtualizedListPanel } from "../../components/virtualized-list-panel";
import { WhatThisMeansSection } from "../../components/what-this-means-section";

import { createGraphAlgorithm, type GraphAlgorithmResult } from "../types";

import type { EulerianCircuitOutputData } from "~/igraph/algorithms/Misc/IgraphEulerianCircuit";
import { eulerianCircuitSliceSteps } from "~/features/visualizer/layer-slice";

export const eulerianCircuit = createGraphAlgorithm<EulerianCircuitOutputData>({
  title: "Eulerian Circuit",
  description:
    "Finds a path that visits every edge exactly once and returns to the starting node.",
  inputs: [],
  wasmFunction: async (igraphController, _) => {
    return await igraphController.eulerianCircuit();
  },
  output: (props) => <EulerianCircuit {...props} />,
  buildSliceSteps: eulerianCircuitSliceSteps,
});

function EulerianCircuit(
  props: GraphAlgorithmResult<EulerianCircuitOutputData>
) {
  const { path, hasCircuit, message } = props.data;
  const hasUsableCircuit = (hasCircuit ?? true) && path.length > 0;

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
      {hasUsableCircuit ? (
        <p className="font-medium text-sm text-positive">
          ✓ Eulerian Circuit completed successfully
        </p>
      ) : (
        <p className="font-medium text-sm text-warning">
          {message ?? "No Eulerian circuit exists for the current graph."}
        </p>
      )}

      {/* Statistics */}
      <p className="text-sm text-typography-secondary">
        Total Weight:{" "}
        <b className="text-typography-primary">
          {hasUsableCircuit ? cumulative[path.length - 1] : 0}
        </b>
      </p>

      {/* Step By Step */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 border-t border-t-border pt-3 isolate">
        <h3 className="shrink-0 font-semibold">Traversal Path</h3>
        <VirtualizedListPanel
            rowComponent={EulerianCircuitRowComponent}
            rowCount={path.length}
            rowHeight={rowHeight}
            rowProps={{ cumulative, path }}
          />
      </div>

      <WhatThisMeansSection>
        <ul className="text-typography-secondary text-sm list-disc list-inside space-y-1">
          <li>
            An Eulerian circuit is a closed walk that{" "}
            <span className="font-medium">uses every edge exactly once</span>{" "}
            and returns to the start.
          </li>
          <li>
            The list shows the exact edge sequence of that circuit and the{" "}
            <span className="font-medium">running total</span> of weights (or
            steps).
          </li>
          <li>
            Existence implies the graph meets Eulerian conditions (e.g., in
            undirected graphs,{" "}
            <span className="font-medium">all vertices have even degree</span>{" "}
            and the graph is connected on edges).
          </li>
          <li>
            Practical use: this is an{" "}
            <span className="font-medium">edge-covering tour</span>, useful in
            routing/inspection problems where every link must be traversed once.
          </li>
        </ul>
      </WhatThisMeansSection>
    </div>
  );
}

function EulerianCircuitRowComponent({
  index,
  style,
  cumulative,
  path: paths,
}: RowComponentProps<{
  cumulative: number[];
  path: EulerianCircuitOutputData["path"];
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
