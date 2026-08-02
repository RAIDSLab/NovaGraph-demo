import { useDynamicRowHeight, type RowComponentProps } from "react-window";

import { createGraphAlgorithm, type GraphAlgorithmResult } from "../types";
import { AlgorithmOutputShell } from "../../components/algorithm-output-shell";
import {
  AlgorithmStat,
  AlgorithmStatGrid,
} from "../../components/algorithm-stat-grid";
import { ClickableNodeLabel } from "../../components/clickable-node-label";
import { VirtualizedListPanel } from "../../components/virtualized-list-panel";

import {
  createAlgorithmSelectInput,
  createNumberInput,
} from "~/features/visualizer/inputs";
import { randomWalkSliceSteps } from "~/features/visualizer/layer-slice";
import type { RandomWalkOutputData } from "~/igraph/algorithms/PathFinding/IgraphRandomWalk";

export const randomWalk = createGraphAlgorithm<RandomWalkOutputData>({
  title: "Random Walk",
  description:
    "Traverses the graph by randomly selecting a neighbor to visit next. It continues for the specified number of steps.",
  inputs: [
    createAlgorithmSelectInput({
      id: "random-walk-start-node",
      key: "start_node",
      displayName: "Start Node",
      source: "nodes",
      required: true,
    }),
    createNumberInput({
      id: "random-walk-steps",
      key: "num_of_steps",
      displayName: "Number of Steps",
      defaultValue: 10,
      min: 1,
      step: 1,
      required: true,
    }),
  ],
  wasmFunction: async (igraphController, [arg1, arg2]) => {
    return await igraphController.randomWalk(arg1, arg2);
  },
  output: (props) => <RandomWalk {...props} />,
  buildSliceSteps: randomWalkSliceSteps,
});

function RandomWalk(props: GraphAlgorithmResult<RandomWalkOutputData>) {
  const { source, steps, maxFrequencyNode, maxFrequency, path } = props.data;

  const rowHeight = useDynamicRowHeight({
    defaultRowHeight: 36,
  });

  const cumulative = path.reduce<number[]>((acc, step, i) => {
    const prev = acc[i - 1] ?? 0;
    acc.push(prev + (step.weight ?? 1));
    return acc;
  }, []);

  return (
    <AlgorithmOutputShell
      header={
        <>
          <p className="font-medium text-sm text-positive">
            ✓ Random Walk completed successfully
          </p>

          <AlgorithmStatGrid>
            <AlgorithmStat label="Source:" value={source} />
            <AlgorithmStat label="Number of Steps:" value={steps} />
            <AlgorithmStat
              label="Node With Max Frequency:"
              value={`${maxFrequencyNode} (${maxFrequency} times visited)`}
            />
          </AlgorithmStatGrid>
        </>
      }
      body={
        <div className="flex min-h-0 flex-1 flex-col gap-2 border-t border-t-border pt-3 isolate">
          <h3 className="shrink-0 font-semibold">Traversal Path</h3>
          <VirtualizedListPanel
            rowComponent={RandomWalkPathRowComponent}
            rowCount={path.length}
            rowHeight={rowHeight}
            rowProps={{ cumulative, path }}
          />
        </div>
      }
      footer={
        <ul className="text-typography-secondary text-sm list-disc list-inside space-y-1">
          <li>
            A Random Walk simulates a step-by-step journey starting from{" "}
            <span className="font-medium">{source}</span>, where each next node
            is chosen randomly from its neighbors.
          </li>
          <li>
            It's useful for analyzing{" "}
            <span className="font-medium">
              network diffusion, influence spread, and centrality
            </span>
            , showing how likely a node is to be revisited over time.
          </li>
          <li>
            The walk took <span className="font-medium">{steps}</span> steps,
            and <span className="font-medium">{maxFrequencyNode}</span> was
            visited <span className="font-medium">{maxFrequency}</span> times,
            indicating it has high connectivity or strong reachability.
          </li>
          <li>
            The traversal path shows the exact visit order, including repeated
            nodes, while cumulative weights track total distance or probability.
          </li>
          <li>
            Because choices are random, running the algorithm again can produce
            a different path and different visitation frequencies.
          </li>
        </ul>
      }
    />
  );
}

function RandomWalkPathRowComponent({
  index,
  style,
  cumulative,
  path: paths,
}: RowComponentProps<{
  cumulative: number[];
  path: RandomWalkOutputData["path"];
}>) {
  const path = paths[index];
  return (
    <div key={index} style={style}>
      <div className="mb-2 space-y-1 rounded-md border border-border px-4 py-3">
        <div className="grid grid-cols-[36px_1fr_auto] gap-4">
          <p className="text-sm font-semibold">{path.step}</p>

          <div className="min-w-0 overflow-hidden">
            <div className="flex h-full items-center gap-2">
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

          <div className="text-right">
            <p className="font-semibold">+{path.weight ?? 1}</p>
            <p className="text-xs text-typography-secondary">Step weight</p>
          </div>
        </div>

        <p className="text-xs text-typography-secondary">
          Cumulative: {cumulative[index - 1] ?? 0} + {path.weight ?? 1} ={" "}
          <b>{cumulative[index]}</b>
        </p>
      </div>
    </div>
  );
}
