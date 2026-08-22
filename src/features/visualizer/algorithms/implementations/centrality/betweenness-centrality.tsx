import { useMemo } from "react";

import { ClickableNodeLabel } from "../../components/clickable-node-label";
import { NodeScoreResultsPanel } from "../../components/node-score-results-panel";
import { WhatThisMeansSection } from "../../components/what-this-means-section";

import { createGraphAlgorithm, type GraphAlgorithmResult } from "../types";

import type { BetweennessCentralityOutputData } from "~/igraph/algorithms/Centrality/IgraphBetweenessCentrality";

export const betweennessCentrality =
  createGraphAlgorithm<BetweennessCentralityOutputData>({
    title: "Betweenness Centrality",
    description:
      "Count how often a node lies on shortest paths between others.",
    inputs: [],
    wasmFunction: async (igraphController, _) => {
      return await igraphController.betweennessCentrality();
    },
    output: (props) => <BetweennessCentrality {...props} />,
    compare: {
      kind: "node-score",
      family: "centrality",
      metric: "betweenness",
      dataKey: "centralities",
    },
  });

function BetweennessCentrality(
  props: GraphAlgorithmResult<BetweennessCentralityOutputData>
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
          ✓ Betweenness Centrality completed successfully
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
            Betweenness centrality counts how often a node lies on{" "}
            <span className="font-medium">
              shortest paths between other pairs
            </span>{" "}
            - a proxy for being a{" "}
            <span className="font-medium">bridge / broker</span> in the network.
          </li>
          {top && (
            <li>
              <ClickableNodeLabel label={top.node} variant="inline" /> has the
              highest score (
              <span className="font-medium">{top.score.toFixed(2)}</span>),
              meaning many shortest paths pass through it compared to others.
            </li>
          )}
          <li>
            In weighted graphs, “shortest” uses edge weights; in unweighted
            graphs it uses hops.
          </li>
        </ul>
      </WhatThisMeansSection>
    </div>
  );
}
