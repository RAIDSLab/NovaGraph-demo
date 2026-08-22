import { useMemo } from "react";

import { ClickableNodeLabel } from "../../components/clickable-node-label";
import { NodeScoreResultsPanel } from "../../components/node-score-results-panel";
import { WhatThisMeansSection } from "../../components/what-this-means-section";

import { createGraphAlgorithm, type GraphAlgorithmResult } from "../types";

import type { HarmonicCentralityOutputData } from "~/igraph/algorithms/Centrality/IgraphHarmonicCentrality";

export const harmonicCentrality =
  createGraphAlgorithm<HarmonicCentralityOutputData>({
    title: "Harmonic Centrality",
    description:
      "Measures the average harmonic mean of the shortest paths between a node to all other nodes.",
    inputs: [],
    wasmFunction: async (igraphController, _) => {
      return await igraphController.harmonicCentrality();
    },
    output: (props) => <HarmonicCentrality {...props} />,
    compare: {
      kind: "node-score",
      family: "centrality",
      metric: "harmonic",
      dataKey: "centralities",
    },
  });

function HarmonicCentrality(
  props: GraphAlgorithmResult<HarmonicCentralityOutputData>
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
          ✓ Harmonic Centrality completed successfully
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
            Harmonic centrality sums the{" "}
            <span className="font-medium">
              reciprocal of shortest-path distances
            </span>{" "}
            to all other nodes, a variant of closeness that handles disconnected
            graphs gracefully.
          </li>
          <li>
            Higher scores mean a node is, on average, at{" "}
            <span className="font-medium">shorter effective distance</span> from
            the rest, even when some nodes are unreachable.
          </li>
          {top && (
            <li>
              Top node is <ClickableNodeLabel label={top.node} variant="inline" />{" "}
              with centrality of{" "}
              <span className="font-medium">{top.score.toFixed(2)}</span>.
            </li>
          )}
          <li>Uses weights if available; otherwise, distances are in hops.</li>
          <li>
            Great for fragmented networks where classic closeness would be
            undefined or biased.
          </li>
        </ul>
      </WhatThisMeansSection>
    </div>
  );
}
