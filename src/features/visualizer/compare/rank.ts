import type { NodeScore } from "./kinds";

export type RankedNodeScore = NodeScore & { rank: number };

/** Non-finite scores sort last and rank as a single tied group. */
const compareScores = (a: number, b: number): number => {
  const aFinite = Number.isFinite(a);
  const bFinite = Number.isFinite(b);
  if (!aFinite && !bFinite) return 0;
  if (!aFinite) return 1;
  if (!bFinite) return -1;
  return b - a;
};

const isSameScore = (a: number, b: number): boolean =>
  a === b || (!Number.isFinite(a) && !Number.isFinite(b));

/**
 * Fractional (average) ranks, 1-based, descending by score, returned in the
 * caller's index order. Tied scores share the midpoint of the positions they
 * span, so metrics with many equal scores (degree centrality especially) no
 * longer report rank movement that is really just input ordering.
 */
export function fractionalRanksByIndex(values: number[]): number[] {
  const order = values.map((_, index) => index);
  order.sort((a, b) => compareScores(values[a], values[b]));

  const ranks = new Array<number>(values.length);
  let start = 0;
  while (start < order.length) {
    let end = start + 1;
    while (
      end < order.length &&
      isSameScore(values[order[end]], values[order[start]])
    ) {
      end += 1;
    }
    // Positions start..end-1 occupy ranks start+1..end.
    const rank = (start + 1 + end) / 2;
    for (let i = start; i < end; i++) {
      ranks[order[i]] = rank;
    }
    start = end;
  }
  return ranks;
}

export function fractionalRank(scores: NodeScore[]): RankedNodeScore[] {
  const ranks = fractionalRanksByIndex(scores.map((item) => item.score));
  return scores
    .map((item, index) => ({ ...item, rank: ranks[index] }))
    .sort((a, b) => a.rank - b.rank);
}

/**
 * Share of the population a rank sits above, in [0, 1]. Rank 1 maps to 1.
 * Comparable across metrics with incompatible units.
 */
export function rankPercentile(rank: number, count: number): number | null {
  if (!Number.isFinite(rank) || count < 1) return null;
  if (count === 1) return 1;
  const percentile = 1 - (rank - 1) / (count - 1);
  return percentile < 0 ? 0 : percentile > 1 ? 1 : percentile;
}

function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 2) return null;

  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i];
    sumY += ys[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let covariance = 0;
  let varianceX = 0;
  let varianceY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    covariance += dx * dy;
    varianceX += dx * dx;
    varianceY += dy * dy;
  }

  // A side with no spread (every score tied) has no ranking to correlate.
  if (varianceX === 0 || varianceY === 0) return null;

  const r = covariance / Math.sqrt(varianceX * varianceY);
  return r < -1 ? -1 : r > 1 ? 1 : r;
}

export type ScorePair = { prevScore: number; currScore: number };

/**
 * Spearman correlation over the nodes present in both runs.
 *
 * Ranks are recomputed within the shared set rather than reused from each full
 * run, because the closed-form `1 - 6*d^2/(n*(n^2-1))` requires the ranks to be
 * a permutation of 1..n. Feeding it whole-run ranks paired with the shared-set
 * size pushes the result outside [-1, 1]. Tie-corrected Pearson on ranks is
 * used for the same reason: the closed form assumes no ties.
 */
export function rankCorrelation(pairs: ScorePair[]): number | null {
  if (pairs.length < 2) return null;
  const prevRanks = fractionalRanksByIndex(pairs.map((pair) => pair.prevScore));
  const currRanks = fractionalRanksByIndex(pairs.map((pair) => pair.currScore));
  return pearson(prevRanks, currRanks);
}
