import {
  useDynamicRowHeight,
  type RowComponentProps,
} from "react-window";

import { createGraphAlgorithm, type GraphAlgorithmResult } from "../types";
import { AlgorithmOutputShell } from "../../components/algorithm-output-shell";
import { VirtualizedListPanel } from "../../components/virtualized-list-panel";

import { createAlgorithmSelectInput } from "~/features/visualizer/inputs";
import type { DFSOutputData } from "~/igraph/algorithms/PathFinding/IgraphDFS";

export const dfs = createGraphAlgorithm<DFSOutputData>({
  title: "Depth-First Search",
  description:
    "Traverses the graph from a source by exploring as far as possible along one branch before backtracking. It continues until all nodes are visited.",
  inputs: [
    createAlgorithmSelectInput({
      id: "dfs-start-node",
      key: "start_node",
      displayName: "Start Node",
      source: "nodes",
      required: true,
    }),
  ],
  wasmFunction: async (igraphController, [arg1]) => {
    return await igraphController.dfs(arg1);
  },
  output: (props) => <DFS {...props} />,
});

const isEmptySubtree = (tree: string[]) => {
  if (!tree || tree.length === 0) return true;
  if (tree.length === 1 && tree[0] === "") return true;
  return false;
};

function DFS(props: GraphAlgorithmResult<DFSOutputData>) {
  const { source, nodesFound, subtrees } = props.data;

  const rowHeight = useDynamicRowHeight({
    defaultRowHeight: 48,
  });

  return (
    <AlgorithmOutputShell
      header={
        <>
          <p className="font-medium text-sm text-positive">
            ✓ DFS completed successfully
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
                Number of Subtrees:
              </span>
              <span className="min-w-0 text-right font-medium text-typography-primary break-words">
                {subtrees.length}
              </span>
            </div>
          </div>
        </>
      }
      body={
        <div className="flex min-h-0 flex-1 flex-col gap-3 border-t border-t-border pt-3 isolate">
          <h3 className="shrink-0 font-semibold">Subtrees</h3>
          <VirtualizedListPanel
            rowComponent={DFSSubtreeRowComponent}
            rowCount={subtrees.length + 1}
            rowHeight={rowHeight}
            rowProps={{ subtrees }}
          />
        </div>
      }
      footer={
        <ul className="text-typography-secondary text-sm list-disc list-inside space-y-1">
            <li>
              Depth-First Search (DFS) explores as deep as possible along each
              path from <span className="font-medium">{source}</span> before
              backtracking and continuing with other branches.
            </li>
            <li>
              It's used to uncover{" "}
              <span className="font-medium">
                connectivity, traversal order, and graph structure
              </span>
              , forming a DFS forest if the graph isn't fully connected.
            </li>
            <li>
              <span className="font-medium">{nodesFound}</span> nodes were
              visited, forming{" "}
              <span className="font-medium">{subtrees.length}</span> subtree
              {subtrees.length !== 1 ? "s" : ""} in total.
            </li>
            <li>
              Each subtree shows the sequence of nodes explored before
              backtracking from root to leaves.
            </li>
            <li>
              DFS does{" "}
              <span className="font-medium">not guarantee shortest paths</span>,
              but reveals how the graph can be reached through recursive
              exploration.
            </li>
          </ul>
      }
    />
  );
}

function DFSSubtreeRowComponent({
  index,
  style,
  subtrees,
}: RowComponentProps<{
  subtrees: DFSOutputData["subtrees"];
}>) {
  if (index === 0) {
    return (
      <div key={index} className="grid grid-cols-3 bg-tabdock" style={style}>
        <span className="font-semibold text-sm px-3 py-1.5">Subtree Index</span>
        <span className="col-span-2 font-semibold text-sm px-3 py-1.5">
          Nodes in Subtree
        </span>
      </div>
    );
  }

  const subtree = subtrees[index - 1];
  return (
    <div
      key={index}
      className="grid grid-cols-3 not-odd:bg-neutral-low/50"
      style={style}
    >
      <span className="font-semibold px-3 py-1.5">{subtree.num}</span>
      {isEmptySubtree(subtree.tree) ? (
        <span className="col-span-2 flex gap-1 overflow-x-auto font-semibold px-3 py-1.5">
          <div className="py-1.5">
            <span className="px-3 py-1.5 rounded-md text-nowrap bg-critical-low">
              Empty Subtree
            </span>
          </div>
        </span>
      ) : (
        <span className="col-span-2 flex gap-1 overflow-x-auto font-semibold px-3 py-1.5">
          {subtree.tree.map((tree, i) => (
            <div key={`${index}-${i}-${tree}`} className="py-1.5">
              <span className="px-3 py-1.5 rounded-md text-nowrap bg-primary-low">
                {tree}
              </span>
              {i < subtree.tree.length - 1 && <span>→</span>}
            </div>
          ))}
        </span>
      )}
    </div>
  );
}
