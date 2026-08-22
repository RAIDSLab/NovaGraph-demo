import { useDynamicRowHeight, type RowComponentProps } from "react-window";
import { ClickableNodeLabel } from "../../components/clickable-node-label";
import { VirtualizedListPanel } from "../../components/virtualized-list-panel";
import { WhatThisMeansSection } from "../../components/what-this-means-section";
import { ChevronRight } from "lucide-react";

import { createGraphAlgorithm, type GraphAlgorithmResult } from "../types";

import type { LeidenOutputData } from "~/igraph/algorithms/Community/IgraphLeiden";
import { createNumberInput } from "~/features/visualizer/inputs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";

export const leiden = createGraphAlgorithm<LeidenOutputData>({
  title: "Leiden Algorithm",
  description:
    "Improved Louvain algorithm that ensures more stable and well-connected communities.",
  inputs: [
    createNumberInput({
      id: "leiden-resolution",
      key: "resolution",
      displayName: "Resolution",
      defaultValue: 0.25,
      min: 0.1,
      max: 2,
      step: 0.01,
      required: true,
    }),
  ],
  wasmFunction: async (igraphController, [arg1]) => {
    return await igraphController.leidenCommunities(arg1);
  },
  output: (props) => <Leiden {...props} />,
  compare: {
    kind: "partition",
    family: "community",
    metric: "leiden",
    dataKey: "communities",
  },
});

function Leiden(props: GraphAlgorithmResult<LeidenOutputData>) {
  const { modularity, quality, communities } = props.data;

  const rowHeight = useDynamicRowHeight({
    defaultRowHeight: 40,
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="shrink-0 space-y-2">
        <p className="font-medium text-sm text-positive">
        ✓ Leiden Algorithm completed successfully
      </p>

      {/* Statistics */}
      <div className="flex flex-col gap-1.5 text-sm">
        <div className="flex items-start justify-between gap-4">
          <span className="text-typography-secondary">Modularity:</span>
          <span className="min-w-0 text-right font-medium text-typography-primary break-words">
            {modularity.toFixed(2)}
          </span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <span className="text-typography-secondary">Quality:</span>
          <span className="min-w-0 text-right font-medium text-typography-primary break-words">
            {quality.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Communities */}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 pt-3 border-t border-t-border">
        <h3 className="shrink-0 font-semibold">Communities</h3>
        {communities.length > 0 ? (
          <VirtualizedListPanel
            rowComponent={LeidenCommunityRowComponent}
            rowCount={communities.length}
            rowHeight={rowHeight}
            rowProps={{ communities }}
          />
        ) : (
          <p className="text-critical font-medium">No communities found</p>
        )}
      </div>

      <WhatThisMeansSection>
        <ul className="text-typography-secondary text-sm list-disc list-inside space-y-1">
          <li>
            Leiden detects communities by iteratively{" "}
            <span className="font-medium">
              optimizing modularity (or a related quality)
            </span>{" "}
            while enforcing better connected, well-formed groups.
          </li>
          <li>
            <span className="font-medium">
              Modularity = {modularity.toFixed(2)}
            </span>{" "}
            and{" "}
            <span className="font-medium">Quality = {quality.toFixed(2)}</span>{" "}
            summarize the partition; compare values only on the{" "}
            <span className="font-medium">same graph and resolution</span>.
          </li>
          <li>
            Resolution controls granularity:{" "}
            <span className="font-medium">higher</span> → more/smaller
            communities; <span className="font-medium">lower</span> →
            fewer/larger.
          </li>
          <li>
            Use when you need{" "}
            <span className="font-medium">
              higher-quality, more stable partitions
            </span>{" "}
            than classic Louvain on complex graphs.
          </li>
        </ul>
      </WhatThisMeansSection>
    </div>
  );
}

function LeidenCommunityRowComponent({
  index,
  style,
  communities,
}: RowComponentProps<{ communities: LeidenOutputData["communities"] }>) {
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
            <ClickableNodeLabel
              key={`${index}-${i}-${c}`}
              label={c}
              variant="chip"
            />
          ))}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
