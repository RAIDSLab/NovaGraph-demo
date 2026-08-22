import { useMemo } from "react";

import { createGraphAlgorithm, type GraphAlgorithmResult } from "../types";
import { AlgorithmOutputShell } from "../../components/algorithm-output-shell";
import { ClickableNodeLabel } from "../../components/clickable-node-label";
import { NodeScoreResultsPanel } from "../../components/node-score-results-panel";

import type { PageRankOutputData } from "~/igraph/algorithms/Centrality/IgraphPageRank";
import { createNumberInput } from "~/features/visualizer/inputs";

export const pageRank = createGraphAlgorithm<PageRankOutputData>({
  title: "Page Rank",
  description: "Rank nodes by the importance of incoming connections.",
  inputs: [
    createNumberInput({
      id: "page-rank-damping",
      key: "damping_factor",
      displayName: "Damping Factor",
      defaultValue: 0.85,
      min: 0,
      max: 1,
      step: 0.01,
      required: true,
    }),
  ],
  wasmFunction: async (igraphController, [arg1]) => {
    return await igraphController.pageRank(arg1);
  },
  output: (props) => <PageRank {...props} />,
  compare: {
    kind: "node-score",
    family: "centrality",
    metric: "page-rank",
    dataKey: "centralities",
  },
});

function PageRank(props: GraphAlgorithmResult<PageRankOutputData>) {
  const { damping, centralities } = props.data;

  const items = useMemo(
    () => centralities.map((c) => ({ node: c.node, score: c.centrality })),
    [centralities]
  );

  const top = items[0]
    ? items.reduce((best, item) => (item.score > best.score ? item : best))
    : null;

  return (
    <AlgorithmOutputShell
      header={
        <>
          <p className="font-medium text-sm text-positive">
            ✓ Page Rank completed successfully
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
                  {top.score.toFixed(4)}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-typography-secondary">Damping:</span>
                <span className="min-w-0 text-right font-medium text-typography-primary break-words">
                  {Number(damping).toFixed(4)}
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
        </>
      }
      body={
        <NodeScoreResultsPanel
          items={items}
          title="Centralities"
          scoreHeader="Centrality"
          formatScore={(score) => score.toFixed(4)}
        />
      }
      footer={
        <ul className="text-typography-secondary text-sm list-disc list-inside space-y-1">
          <li>
            PageRank models a random surfer who follows links with probability{" "}
            <span className="font-medium">{Number(damping).toFixed(4)}</span> and
            “teleports” otherwise, nodes with more{" "}
            <span className="font-medium">high-quality incoming links</span>{" "}
            score higher.
          </li>
          {top && (
            <li>
              <ClickableNodeLabel label={top.node} variant="inline" /> ranks
              highest with score{" "}
              <span className="font-medium">{top.score.toFixed(4)}</span>.
            </li>
          )}
          <li>
            The <span className="font-medium">damping factor</span> controls how
            often the surfer teleports (typical ~0.85); lower values spread
            importance more uniformly.
          </li>
          <li>
            Direction and edge weights (if used) matter: strong or numerous
            inbound links from important pages amplify rank.
          </li>
          <li>
            Use PageRank to find{" "}
            <span className="font-medium">authoritative or trusted</span> nodes
            in citation, web, and influence graphs.
          </li>
        </ul>
      }
    />
  );
}
