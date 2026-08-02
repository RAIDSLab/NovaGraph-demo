import { useMemo } from "react";

import { ClickableNodeLabel } from "../../components/clickable-node-label";
import { NodeScoreResultsPanel } from "../../components/node-score-results-panel";
import { WhatThisMeansSection } from "../../components/what-this-means-section";

import { createGraphAlgorithm, type GraphAlgorithmResult } from "../types";

import type { DegreeCentralityOutputData } from "~/igraph/algorithms/Centrality/IgraphDegreeCentrality";

export const degreeCentrality =
  createGraphAlgorithm<DegreeCentralityOutputData>({
    title: "Degree Centrality",
    description: "Measures the number of edges connected to a node.",
    inputs: [],
    wasmFunction: async (igraphController, _) => {
      return await igraphController.degreeCentrality();
    },
    output: (props) => <DegreeCentrality {...props} />,
  });

function DegreeCentrality(
  props: GraphAlgorithmResult<DegreeCentralityOutputData>
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
          ✓ Degree Centrality completed successfully
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
            Degree centrality counts how many{" "}
            <span className="font-medium">edges</span> touch a node, a direct
            measure of its immediate connectivity.
          </li>
          <li>
            Higher values indicate nodes with many neighbors (potential hubs).
            In directed graphs, degree may be split into{" "}
            <span className="font-medium">in-/out-degree</span> depending on
            settings.
          </li>
          {top && (
            <li>
              <ClickableNodeLabel label={top.node} variant="inline" /> has the
              highest degree (
              <span className="font-medium">{top.score.toFixed(2)}</span>).
            </li>
          )}
          <li>
            This metric ignores edge weights. For weighted connectivity, see{" "}
            <span className="font-medium">Node Strength</span>.
          </li>
          <li>
            Useful for spotting <span className="font-medium">local hubs</span>,
            but it doesn’t account for who those neighbors are.
          </li>
        </ul>
      </WhatThisMeansSection>
    </div>
  );
}
