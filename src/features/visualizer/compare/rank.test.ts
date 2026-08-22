import {
  fractionalRank,
  fractionalRanksByIndex,
  rankCorrelation,
  rankPercentile,
} from "./rank";
import { compareNodeScores } from "./node-score";

const scores = (entries: [string, number][]) =>
  entries.map(([node, score]) => ({ node, score }));

describe("fractionalRanksByIndex", () => {
  test("ranks descending with 1 as the best", () => {
    expect(fractionalRanksByIndex([5, 9, 1])).toEqual([2, 1, 3]);
  });

  test("ties share the midpoint of the positions they span", () => {
    // Two nodes tied for positions 1-2 both get 1.5, the next takes rank 3.
    expect(fractionalRanksByIndex([7, 7, 2])).toEqual([1.5, 1.5, 3]);
  });

  test("a fully tied population gets one shared rank", () => {
    expect(fractionalRanksByIndex([4, 4, 4, 4])).toEqual([2.5, 2.5, 2.5, 2.5]);
  });

  test("non-finite scores rank last as a single group", () => {
    expect(fractionalRanksByIndex([NaN, 3, NaN, 8])).toEqual([3.5, 2, 3.5, 1]);
  });

  test("empty input yields no ranks", () => {
    expect(fractionalRanksByIndex([])).toEqual([]);
  });
});

describe("fractionalRank", () => {
  test("returns entries ordered best-first", () => {
    const ranked = fractionalRank(
      scores([
        ["a", 1],
        ["b", 3],
        ["c", 2],
      ])
    );
    expect(ranked.map((item) => item.node)).toEqual(["b", "c", "a"]);
    expect(ranked.map((item) => item.rank)).toEqual([1, 2, 3]);
  });
});

describe("rankPercentile", () => {
  test("maps the best rank to 1 and the worst to 0", () => {
    expect(rankPercentile(1, 5)).toBe(1);
    expect(rankPercentile(5, 5)).toBe(0);
    expect(rankPercentile(3, 5)).toBe(0.5);
  });

  test("a single-node population is always the top", () => {
    expect(rankPercentile(1, 1)).toBe(1);
  });

  test("rejects an empty population", () => {
    expect(rankPercentile(1, 0)).toBeNull();
  });
});

describe("rankCorrelation", () => {
  test("identical ordering correlates at 1", () => {
    const pairs = [
      { prevScore: 1, currScore: 10 },
      { prevScore: 2, currScore: 20 },
      { prevScore: 3, currScore: 30 },
    ];
    expect(rankCorrelation(pairs)).toBeCloseTo(1, 10);
  });

  test("exactly reversed ordering correlates at -1", () => {
    const pairs = [
      { prevScore: 1, currScore: 30 },
      { prevScore: 2, currScore: 20 },
      { prevScore: 3, currScore: 10 },
    ];
    expect(rankCorrelation(pairs)).toBeCloseTo(-1, 10);
  });

  test("returns null when one side has no spread", () => {
    const pairs = [
      { prevScore: 5, currScore: 1 },
      { prevScore: 5, currScore: 2 },
      { prevScore: 5, currScore: 3 },
    ];
    expect(rankCorrelation(pairs)).toBeNull();
  });

  test("fewer than two shared nodes is undefined rather than an error", () => {
    expect(rankCorrelation([])).toBeNull();
    expect(rankCorrelation([{ prevScore: 1, currScore: 2 }])).toBeNull();
  });

  test("stays within [-1, 1] when ties are present", () => {
    const pairs = [
      { prevScore: 3, currScore: 1 },
      { prevScore: 3, currScore: 1 },
      { prevScore: 2, currScore: 5 },
      { prevScore: 1, currScore: 5 },
      { prevScore: 1, currScore: 2 },
    ];
    const r = rankCorrelation(pairs) as number;
    expect(r).toBeGreaterThanOrEqual(-1);
    expect(r).toBeLessThanOrEqual(1);
  });
});

describe("compareNodeScores", () => {
  test("a tie-heavy metric compared with itself reports no rank movement", () => {
    // Same values, different emission order — the old sort-position ranking
    // turned this into phantom rank deltas.
    const previous = scores([
      ["a", 3],
      ["b", 3],
      ["c", 3],
      ["d", 1],
    ]);
    const current = scores([
      ["c", 3],
      ["a", 3],
      ["b", 3],
      ["d", 1],
    ]);

    const { rows, summary } = compareNodeScores(previous, current);

    expect(rows.every((row) => row.rankDelta === 0)).toBe(true);
    expect(summary.spearman).toBeCloseTo(1, 10);
  });

  test("correlation stays in range when the node sets differ", () => {
    const previous = scores([
      ["a", 10],
      ["b", 8],
      ["c", 6],
      ["d", 4],
      ["e", 2],
      ["f", 1],
    ]);
    // Three of the six nodes are missing from the second run.
    const current = scores([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);

    const { summary } = compareNodeScores(previous, current);

    expect(summary.sharedCount).toBe(3);
    expect(summary.spearman).toBeCloseTo(-1, 10);
  });

  test("nodes only in one run get null deltas instead of being dropped", () => {
    const { rows } = compareNodeScores(scores([["a", 1]]), scores([["b", 2]]));

    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.rankDelta).toBeNull();
      expect(row.scoreDelta).toBeNull();
      expect(row.percentileDelta).toBeNull();
    }
  });

  test("empty runs do not throw", () => {
    const { rows, summary } = compareNodeScores([], []);
    expect(rows).toEqual([]);
    expect(summary.spearman).toBeNull();
    expect(summary.topK).toBe(0);
  });
});
