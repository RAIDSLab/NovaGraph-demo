import { createGraphAlgorithm, type GraphAlgorithmResult } from "../types";
import { ClickableNodeLabel } from "../../components/clickable-node-label";
import { FlexibleScrollPanel } from "../../components/flexible-scroll-panel";
import { WhatThisMeansSection } from "../../components/what-this-means-section";

import { createNumberInput } from "~/features/visualizer/inputs";
import type { KCoreOutputData } from "~/igraph/algorithms/Community/IgraphKCore";

export const kCore = createGraphAlgorithm<KCoreOutputData>({
  title: "K-Core Decomposition",
  description:
    "Finds groups of nodes where each has at least k neighbors within the group.",
  inputs: [
    createNumberInput({
      id: "k-core-k",
      key: "k",
      displayName: "K",
      defaultValue: 1,
      min: 1,
      step: 1,
      required: true,
    }),
  ],
  wasmFunction: async (igraphController, [arg1]) => {
    return await igraphController.kCore(arg1);
  },
  output: (props) => <KCore {...props} />,
});

function KCore(props: GraphAlgorithmResult<KCoreOutputData>) {
  const { k, max_coreness, cores } = props.data;
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="shrink-0 space-y-2">
        <p className="font-medium text-sm text-positive">
        ✓ K Core Decomposition completed successfully
      </p>

      {/* Statistics */}
      <div className="flex flex-col gap-1.5 text-sm">
        <div className="flex items-start justify-between gap-4">
          <span className="text-typography-secondary">K:</span>
          <span className="min-w-0 text-right font-medium text-typography-primary break-words">{k}</span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <span className="text-typography-secondary">Max Coreness:</span>
          <span className="min-w-0 text-right font-medium text-typography-primary break-words">
            {max_coreness}
          </span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <span className="text-typography-secondary">
            Number of Nodes in Core:
          </span>
          <span className="min-w-0 text-right font-medium text-typography-primary break-words">
            {cores.length}
          </span>
        </div>
      </div>

      {/* Nodes in 2-Core */}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 pt-3 border-t border-t-border">
        <h3 className="shrink-0 font-semibold">Nodes in Core</h3>
        <FlexibleScrollPanel>
          {cores.length > 0 ? (
            <div className="flex flex-wrap gap-2 p-1">
              {cores.map((core, i) => (
                <ClickableNodeLabel
                  key={`${i}-${core}`}
                  label={core}
                  variant="chip"
                  className="max-w-96 truncate whitespace-nowrap"
                />
              ))}
            </div>
          ) : (
            <p className="text-critical font-medium p-1">
              No nodes in the graph has degree of {k}
            </p>
          )}
        </FlexibleScrollPanel>
      </div>

      <WhatThisMeansSection>
        <ul className="text-typography-secondary text-sm list-disc list-inside space-y-1">
          <li>
            A <span className="font-medium">{k}-core</span> is the maximal set
            of nodes where every node has degree{" "}
            <span className="font-medium">≥ {k}</span>{" "}
            <em>within the induced subgraph</em>.
          </li>
          <li>
            The {cores.length} nodes listed form the{" "}
            <span className="font-medium">{k}-core</span>; removing any node
            would violate the degree threshold for someone in the set.
          </li>
          <li>
            <span className="font-medium">Max coreness = {max_coreness}</span>{" "}
            means the graph contains a non-empty{" "}
            <span className="font-medium">{max_coreness}-core</span>; higher
            coreness suggests a denser, more central nucleus.
          </li>
          <li>
            Use cases: peeling dense layers, identifying robust “core” regions,
            and seeding community/centrality analyses.
          </li>
        </ul>
      </WhatThisMeansSection>
    </div>
  );
}
