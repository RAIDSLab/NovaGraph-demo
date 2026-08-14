import type { NodeScore } from "./kinds";

export type RankedNodeScore = NodeScore & { rank: number };

export type NodeScoreDiffRow = {
  node: string;
  prevRank: number | null;
  currRank: number | null;
  rankDelta: number | null;
  prevScore: number | null;
  currScore: number | null;
  scoreDelta: number | null;
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

function rankScores(scores: NodeScore[]): RankedNodeScore[] {
  return [...scores]
    .sort((a, b) => b.score - a.score)
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

/** Spearman rank correlation on shared nodes (by rank). */
function spearmanCorrelation(rows: NodeScoreDiffRow[]): number | null {
  const paired = rows.filter(
    (row) => row.prevRank != null && row.currRank != null
  );
  const n = paired.length;
  if (n < 2) return null;

  let sumD2 = 0;
  for (const row of paired) {
    const d = (row.prevRank as number) - (row.currRank as number);
    sumD2 += d * d;
  }
  return 1 - (6 * sumD2) / (n * (n * n - 1));
}

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
  const prevRanked = rankScores(previous);
  const currRanked = rankScores(current);

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
      (a, b) => Math.abs(b.rankDelta as number) - Math.abs(a.rankDelta as number)
    )
    .slice(0, 5);

  return {
    rows,
    summary: {
      nodeCount: rows.length,
      sharedCount: shared.length,
      topK,
      topKOverlap: topK > 0 ? topKOverlap(prevRanked, currRanked, topK) : 0,
      spearman: spearmanCorrelation(rows),
      biggestMovers,
    },
  };
}
