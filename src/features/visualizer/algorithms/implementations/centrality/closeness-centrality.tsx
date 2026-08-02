import { useMemo } from "react";

import { ClickableNodeLabel } from "../../components/clickable-node-label";
import { NodeScoreResultsPanel } from "../../components/node-score-results-panel";
import { WhatThisMeansSection } from "../../components/what-this-means-section";

import { createGraphAlgorithm, type GraphAlgorithmResult } from "../types";

import type { ClosenessCentralityOutputData } from "~/igraph/algorithms/Centrality/IgraphCloseCentrality";

export const closenessCentrality =
  createGraphAlgorithm<ClosenessCentralityOutputData>({
    title: "Closeness Centrality",
    description:
      "Measures the average shortest path between a node and all other nodes.",
    inputs: [],
    wasmFunction: async (igraphController, _) => {
      return await igraphController.closenessCentrality();
    },
    output: (props) => <ClosenessCentrality {...props} />,
  });

function ClosenessCentrality(
  props: GraphAlgorithmResult<ClosenessCentralityOutputData>
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
          ✓ Closeness Centrality completed successfully
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
            Closeness centrality measures how{" "}
            <span className="font-medium">close</span> a node is to all others,
            typically as the inverse of its{" "}
            <span className="font-medium">average shortest-path distance</span>.
          </li>
          <li>
            Nodes with <span className="font-medium">higher scores</span> can
            reach others with fewer steps on average, good for fast diffusion or
            access.
          </li>
          {top && (
            <li>
              <ClickableNodeLabel label={top.node} variant="inline" /> is most
              central here with score{" "}
              <span className="font-medium">{top.score.toFixed(2)}</span>.
            </li>
          )}
          <li>
            Distances use <span className="font-medium">edge weights</span> when
            provided; otherwise they count hops. Disconnected nodes may reduce
            or nullify scores depending on normalization.
          </li>
        </ul>
      </WhatThisMeansSection>
    </div>
  );
}
