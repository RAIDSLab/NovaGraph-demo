import type { NodeScore } from "./kinds";
import {
  fractionalRank,
  rankCorrelation,
  rankPercentile,
  type RankedNodeScore,
} from "./rank";

export type { RankedNodeScore };

export type NodeScoreDiffRow = {
  node: string;
  prevRank: number | null;
  currRank: number | null;
  rankDelta: number | null;
  prevScore: number | null;
  currScore: number | null;
  scoreDelta: number | null;
  /** Unit-free stand-in for score when the two runs use different metrics. */
  prevPercentile: number | null;
  currPercentile: number | null;
  percentileDelta: number | null;
};

export type NodeScoreCompareResult = {
  rows: NodeScoreDiffRow[];
  summary: {
    nodeCount: number;
    sharedCount: number;
    topKOverlap: number;
    topK: number;
    spearman: number | null;
    biggestMovers: NodeScoreDiffRow[];
  };
};

function topKOverlap(
  prev: RankedNodeScore[],
  curr: RankedNodeScore[],
  k: number
): number {
  const prevTop = new Set(prev.slice(0, k).map((item) => item.node));
  const currTop = curr.slice(0, k).map((item) => item.node);
  let overlap = 0;
  for (const node of currTop) {
    if (prevTop.has(node)) overlap += 1;
  }
  return overlap;
}

export function compareNodeScores(
  previous: NodeScore[],
  current: NodeScore[]
): NodeScoreCompareResult {
  const prevRanked = fractionalRank(previous);
  const currRanked = fractionalRank(current);

  const prevMap = new Map(prevRanked.map((item) => [item.node, item]));
  const currMap = new Map(currRanked.map((item) => [item.node, item]));
  const nodes = new Set([...prevMap.keys(), ...currMap.keys()]);

  const rows: NodeScoreDiffRow[] = [];
  for (const node of nodes) {
    const prev = prevMap.get(node);
    const curr = currMap.get(node);
    const prevRank = prev?.rank ?? null;
    const currRank = curr?.rank ?? null;
    const prevScore = prev?.score ?? null;
    const currScore = curr?.score ?? null;

    const prevPercentile =
      prevRank == null ? null : rankPercentile(prevRank, prevRanked.length);
    const currPercentile =
      currRank == null ? null : rankPercentile(currRank, currRanked.length);

    rows.push({
      node,
      prevRank,
      currRank,
      rankDelta:
        prevRank != null && currRank != null ? prevRank - currRank : null,
      prevScore,
      currScore,
      scoreDelta:
        prevScore != null && currScore != null ? currScore - prevScore : null,
      prevPercentile,
      currPercentile,
      percentileDelta:
        prevPercentile != null && currPercentile != null
          ? currPercentile - prevPercentile
          : null,
    });
  }

  rows.sort((a, b) => {
    const aRank = a.currRank ?? a.prevRank ?? Number.POSITIVE_INFINITY;
    const bRank = b.currRank ?? b.prevRank ?? Number.POSITIVE_INFINITY;
    return aRank - bRank;
  });

  const shared = rows.filter(
    (row) => row.prevRank != null && row.currRank != null
  );
  const topK = Math.min(10, prevRanked.length, currRanked.length);
  const biggestMovers = [...shared]
    .filter((row) => row.rankDelta != null)
    .sort(
      (a, b) =>
        Math.abs(b.rankDelta as number) - Math.abs(a.rankDelta as number)
    )
    .slice(0, 5);

  return {
    rows,
    summary: {
      nodeCount: rows.length,
      sharedCount: shared.length,
      topK,
      topKOverlap: topK > 0 ? topKOverlap(prevRanked, currRanked, topK) : 0,
      spearman: rankCorrelation(
        shared.map((row) => ({
          prevScore: row.prevScore as number,
          currScore: row.currScore as number,
        }))
      ),
      biggestMovers,
    },
  };
}
