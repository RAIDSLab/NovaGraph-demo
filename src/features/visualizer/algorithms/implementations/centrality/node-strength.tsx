import { useMemo } from "react";

import { ClickableNodeLabel } from "../../components/clickable-node-label";
import { NodeScoreResultsPanel } from "../../components/node-score-results-panel";
import { WhatThisMeansSection } from "../../components/what-this-means-section";

import { createGraphAlgorithm, type GraphAlgorithmResult } from "../types";

import type { StrengthCentralityOutputData } from "~/igraph/algorithms/Centrality/IgraphStrengthCentrality";

export const nodeStrengthCentrality =
  createGraphAlgorithm<StrengthCentralityOutputData>({
    title: "Node Strength",
    description:
      "Measures the sum of the weights of the edges connected to a node.",
    inputs: [],
    wasmFunction: async (igraphController, _) => {
      return await igraphController.strengthCentrality();
    },
    output: (props) => <NodeStrengthCentrality {...props} />,
  });

function NodeStrengthCentrality(
  props: GraphAlgorithmResult<StrengthCentralityOutputData>
) {
  const { centralities } = props.data;

  const items = useMemo(
    () => centralities.map((c) => ({ node: c.node, score: c.centrality })),
    [centralities]
  );

  const top = items[0]
    ? items.reduce((best, item) => (item.score > best.score ? item : best))
    : null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="shrink-0 space-y-2">
        <p className="font-medium text-sm text-positive">
          ✓ Node Strength Centrality completed successfully
        </p>

        {top && (
          <div className="flex flex-col gap-1.5 text-sm">
            <div className="flex items-start justify-between gap-4">
              <span className="text-typography-secondary">
                Most Central Node:
              </span>
              <ClickableNodeLabel
                label={top.node}
                className="min-w-0 text-right font-medium break-words whitespace-normal"
              />
            </div>
            <div className="flex items-start justify-between gap-4">
              <span className="text-typography-secondary">
                Max Centrality Score:
              </span>
              <span className="min-w-0 text-right font-medium text-typography-primary break-words">
                {top.score.toFixed(2)}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span className="text-typography-secondary">Nodes Analyzed:</span>
              <span className="min-w-0 text-right font-medium text-typography-primary break-words">
                {items.length}
              </span>
            </div>
          </div>
        )}
      </div>

      <NodeScoreResultsPanel
        items={items}
        title="Centralities"
        scoreHeader="Centrality"
      />

      <WhatThisMeansSection>
        <ul className="text-typography-secondary text-sm list-disc list-inside space-y-1">
          <li>
            Node strength is the{" "}
            <span className="font-medium">sum of weights</span> of edges
            incident to a node, a weighted analogue of degree.
          </li>
          <li>
            Higher values indicate nodes with{" "}
            <span className="font-medium">many and/or heavy</span> connections
            (e.g., capacity, bandwidth, interaction volume).
          </li>
          {top && (
            <li>
              Top node is <ClickableNodeLabel label={top.node} variant="inline" />{" "}
              with centrality of{" "}
              <span className="font-medium">{top.score.toFixed(2)}</span>.
            </li>
          )}
          <li>
            If your graph is unweighted, strength reduces to degree (each edge
            weight = 1).
          </li>
          <li>
            Good for ranking nodes by{" "}
            <span className="font-medium">aggregate connectivity</span> where
            edge weights matter.
          </li>
        </ul>
      </WhatThisMeansSection>
    </div>
  );
}
