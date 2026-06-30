import { useDynamicRowHeight, type RowComponentProps } from "react-window";
import { VirtualizedListPanel } from "../../components/virtualized-list-panel";
import { ChevronRight } from "lucide-react";

import { createGraphAlgorithm, type GraphAlgorithmResult } from "../types";

import type { LabelPropagationOutputData } from "~/igraph/algorithms/Community/IgraphLabelPropagation";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";

export const labelPropagation =
  createGraphAlgorithm<LabelPropagationOutputData>({
    title: "Label Propagation",
    description:
      "Assigns nodes to communities based on their labels. Results may vary between runs due to the randomness of the algorithm.",
    inputs: [],
    wasmFunction: async (igraphController, _) => {
      return await igraphController.labelPropagation();
    },
    output: (props) => <LabelPropagation {...props} />,
  });

function LabelPropagation(
  props: GraphAlgorithmResult<LabelPropagationOutputData>
) {
  const { communities } = props.data;

  const rowHeight = useDynamicRowHeight({
    defaultRowHeight: 40,
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <p className="font-medium text-sm text-positive">
        ✓ Label Propagation completed successfully
      </p>

      {/* Communities */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 pt-3 border-t border-t-border">
        <h3 className="shrink-0 font-semibold">Communities</h3>
        {communities.length > 0 ? (
          <VirtualizedListPanel
            rowComponent={LabelPropagationCommunityRowComponent}
            rowCount={communities.length}
            rowHeight={rowHeight}
            rowProps={{ communities }}
          />
        ) : (
          <p className="text-critical font-medium">No communities found</p>
        )}
      </div>

      {/* What this means */}
      <div className="shrink-0 max-h-28 space-y-3 overflow-y-auto border-t border-t-border pt-3">
        <h3 className="shrink-0 font-semibold">What this means</h3>
        <ul className="text-typography-secondary text-sm list-disc list-inside space-y-1">
          <li>
            Label Propagation assigns communities by letting nodes adopt the{" "}
            <span className="font-medium">
              most common label among neighbors
            </span>{" "}
            until labels stabilize.
          </li>
          <li>
            The listed communities are the final labels; results can{" "}
            <span className="font-medium">vary between runs</span> due to random
            tie-breaking.
          </li>
          <li>
            Fast and scalable: good for large graphs when you need a{" "}
            <span className="font-medium">quick partition</span> without
            optimizing a global objective like modularity.
          </li>
        </ul>
      </div>
    </div>
  );
}

function LabelPropagationCommunityRowComponent({
  index,
  style,
  communities,
}: RowComponentProps<{
  communities: LabelPropagationOutputData["communities"];
}>) {
  const community = communities[index];
  return (
    <div key={index} style={style}>
      <Collapsible
        defaultOpen={true}
        className="border border-primary-low rounded-md mb-2 transition-colors duration-150 hover:bg-primary-low/50"
      >
        <CollapsibleTrigger className="px-3 py-1.5 w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">Community {index + 1}</p>
            <span className="px-3 py-1.5 rounded-md text-xs bg-primary-low text-primary">
              {community.length} nodes
            </span>
          </div>
          <ChevronRight />
        </CollapsibleTrigger>
        <CollapsibleContent className="px-3 py-2 flex flex-wrap gap-1">
          {community.map((c, i) => (
            <span
              key={`${index}-${i}-${c}`}
              className="px-3 py-1.5 rounded-md bg-primary-low"
            >
              {c}
            </span>
          ))}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
