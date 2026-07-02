import {
  useDynamicRowHeight,
  type RowComponentProps,
} from "react-window";

import { createGraphAlgorithm, type GraphAlgorithmResult } from "../types";
import { AlgorithmOutputShell } from "../../components/algorithm-output-shell";
import { VirtualizedListPanel } from "../../components/virtualized-list-panel";

import { createAlgorithmSelectInput } from "~/features/visualizer/inputs";
import type { BFSOutputData } from "~/igraph/algorithms/PathFinding/IgraphBFS";

export const bfs = createGraphAlgorithm<BFSOutputData>({
  title: "Breadth-First Search",
  description:
    "Traverses the graph from a source by exploring all neighbors level by level. It continues until all nodes are visited.",
  inputs: [
    createAlgorithmSelectInput({
      id: "bfs-start-node",
      key: "start_node",
      displayName: "Start Node",
      source: "nodes",
      required: true,
    }),
  ],
  wasmFunction: async (igraphController, [arg1]) => {
    return await igraphController.bfs(arg1);
  },
  output: (props) => <BFS {...props} />,
});

function BFS(props: GraphAlgorithmResult<BFSOutputData>) {
  const { source, nodesFound, layers } = props.data;

  const rowHeight = useDynamicRowHeight({
    defaultRowHeight: 48,
  });

  return (
    <AlgorithmOutputShell
      header={
        <>
          <p className="font-medium text-sm text-positive">
            ✓ BFS completed successfully
          </p>

          <div className="flex flex-col gap-1.5 text-sm">
            <div className="flex items-start justify-between gap-4">
              <span className="text-typography-secondary">Source:</span>
              <span className="min-w-0 text-right font-medium text-typography-primary break-words">
                {source}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span className="text-typography-secondary">Nodes Found:</span>
              <span className="min-w-0 text-right font-medium text-typography-primary break-words">
                {nodesFound}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span className="text-typography-secondary">
                Number of Layers:
              </span>
              <span className="min-w-0 text-right font-medium text-typography-primary break-words">
                {layers.length}
              </span>
            </div>
          </div>
        </>
      }
      body={
        <div className="flex min-h-0 flex-1 flex-col gap-3 border-t border-t-border pt-3 isolate">
          <h3 className="shrink-0 font-semibold">Layers</h3>
          <VirtualizedListPanel
            rowComponent={BFSLayerRowComponent}
            rowCount={layers.length + 1}
            rowHeight={rowHeight}
            rowProps={{ layers }}
          />
        </div>
      }
      footer={
        <ul className="text-typography-secondary text-sm list-disc list-inside space-y-1">
            <li>
              Breadth-First Search (BFS) explores the graph layer by layer,
              starting from <span className="font-medium">{source}</span>,
              visiting all nearby nodes before moving farther away.
            </li>
            <li>
              It's commonly used to find the{" "}
              <span className="font-medium">shortest path (in hops)</span> between
              nodes in an unweighted graph or to discover connected components.
            </li>
            <li>
              <span className="font-medium">{nodesFound}</span> nodes were
              reachable from the source and grouped into{" "}
              <span className="font-medium">{layers.length}</span> layers.
            </li>
            <li>
              Each layer represents nodes that are the same distance from the
              source. Layer 0 is the source itself; later layers are farther
              away.
            </li>
            <li>
              If some nodes don't appear in any layer, they're not reachable from{" "}
              <span className="font-medium">{source}</span>.
            </li>
          </ul>
      }
    />
  );
}

function BFSLayerRowComponent({
  index,
  style,
  layers,
}: RowComponentProps<{ layers: BFSOutputData["layers"] }>) {
  if (index === 0) {
    return (
      <div key={index} className="grid grid-cols-3 bg-tabdock" style={style}>
        <span className="font-semibold text-sm px-3 py-1.5">Layer Index</span>
        <span className="col-span-2 font-semibold text-sm px-3 py-1.5">
          Nodes in Layer
        </span>
      </div>
    );
  }

  const layer = layers[index - 1];
  return (
    <div
      key={index}
      className="grid grid-cols-3 not-odd:bg-neutral-low/50"
      style={style}
    >
      <span className="font-semibold px-3 py-1.5">{layer.index}</span>
      <span className="col-span-2 flex flex-wrap gap-1 font-semibold px-3 py-1.5">
        {layer.layer.map((layer, i) => (
          <span
            key={`${index}-${i}-${layer}`}
            className="px-3 py-1.5 rounded-md bg-primary-low"
          >
            {layer}
          </span>
        ))}
      </span>
    </div>
  );
}
