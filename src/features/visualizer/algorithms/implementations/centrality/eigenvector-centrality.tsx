import { useMemo } from "react";

import { ClickableNodeLabel } from "../../components/clickable-node-label";
import { NodeScoreResultsPanel } from "../../components/node-score-results-panel";
import { WhatThisMeansSection } from "../../components/what-this-means-section";

import { createGraphAlgorithm, type GraphAlgorithmResult } from "../types";

import type { EigenvectorCentralityOutputData } from "~/igraph/algorithms/Centrality/IgraphEigenvectorCentrality";

export const eigenvectorCentrality =
  createGraphAlgorithm<EigenvectorCentralityOutputData>({
    title: "Eigenvector Centrality",
    description: "Measures the influence of a node in a network.",
    inputs: [],
    wasmFunction: async (igraphController, _) => {
      return await igraphController.eigenvectorCentrality();
    },
    output: (props) => <EigenvectorCentrality {...props} />,
    compare: {
      kind: "node-score",
      family: "centrality",
      metric: "eigenvector",
      dataKey: "centralities",
    },
  });

function EigenvectorCentrality(
  props: GraphAlgorithmResult<EigenvectorCentralityOutputData>
) {
  const { eigenvalue, centralities } = props.data;

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
          ✓ Eigenvector Centrality completed successfully
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
              <span className="text-typography-secondary">Eigenvalue:</span>
              <span className="min-w-0 text-right font-medium text-typography-primary break-words">
                {eigenvalue.toFixed(2)}
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
            Eigenvector centrality scores nodes higher when they are connected
            to <span className="font-medium">other high-scoring nodes</span>,
            influence is <em>recursive</em>.
          </li>
          {top && (
            <li>
              <ClickableNodeLabel label={top.node} variant="inline" /> ranks
              highest (
              <span className="font-medium">{top.score.toFixed(2)}</span>),
              indicating connections into influential regions.
            </li>
          )}
          <li>
            The reported <span className="font-medium">eigenvalue</span>{" "}
            summarizes the leading factor of the network’s influence structure:{" "}
            <span className="font-medium">{eigenvalue.toFixed(2)}</span>.
          </li>
          <li>
            Useful for identifying{" "}
            <span className="font-medium">influencers</span> that are not just
            popular, but popular among the popular.
          </li>
          <li>
            Sensitive to graph direction/weights and to disconnected components;
            compare within the same dataset.
          </li>
        </ul>
      </WhatThisMeansSection>
    </div>
  );
}
