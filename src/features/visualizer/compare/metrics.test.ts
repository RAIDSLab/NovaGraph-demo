import {
  adjustedRandIndex,
  buildContingency,
  buildSpread,
  matchCommunities,
  normalizedMutualInformation,
  type Membership,
} from "./metrics";
import { comparePartitions } from "./partition";

const membership = (partitions: string[][]): Membership => {
  const map: Membership = new Map();
  partitions.forEach((group, id) => group.forEach((node) => map.set(node, id)));
  return map;
};

const contingencyOf = (prev: string[][], curr: string[][]) =>
  buildContingency(membership(prev), membership(curr));

describe("buildContingency", () => {
  test("counts only nodes present in both partitions", () => {
    const contingency = contingencyOf(
      [
        ["a", "b"],
        ["c", "gone"],
      ],
      [["a", "b"], ["c"]]
    );

    expect(contingency.total).toBe(3);
    expect(contingency.prevTotals.get(1)).toBe(1);
  });

  test("collapses repeated pairs into one cell", () => {
    const contingency = contingencyOf([["a", "b", "c"]], [["a", "b", "c"]]);

    expect(contingency.cells).toEqual([
      { prevCommunity: 0, currCommunity: 0, count: 3 },
    ]);
  });
});

describe("adjustedRandIndex", () => {
  test("identical partitions score 1", () => {
    const contingency = contingencyOf(
      [
        ["a", "b"],
        ["c", "d"],
      ],
      [
        ["a", "b"],
        ["c", "d"],
      ]
    );
    expect(adjustedRandIndex(contingency)).toBeCloseTo(1, 10);
  });

  test("relabelling communities does not change the score", () => {
    const relabelled = contingencyOf(
      [
        ["a", "b"],
        ["c", "d"],
      ],
      [
        ["c", "d"],
        ["a", "b"],
      ]
    );
    expect(adjustedRandIndex(relabelled)).toBeCloseTo(1, 10);
  });

  test("an unrelated partition sits near zero", () => {
    // Splitting each original community across both new ones carries no signal.
    const contingency = contingencyOf(
      [
        ["a", "b", "c", "d"],
        ["e", "f", "g", "h"],
      ],
      [
        ["a", "b", "e", "f"],
        ["c", "d", "g", "h"],
      ]
    );
    expect(Math.abs(adjustedRandIndex(contingency) as number)).toBeLessThan(
      0.2
    );
  });

  test("a single shared node has no pair to score", () => {
    expect(adjustedRandIndex(contingencyOf([["a"]], [["a"]]))).toBeNull();
  });
});

describe("normalizedMutualInformation", () => {
  test("identical partitions score 1", () => {
    const contingency = contingencyOf(
      [
        ["a", "b"],
        ["c", "d"],
      ],
      [
        ["a", "b"],
        ["c", "d"],
      ]
    );
    expect(normalizedMutualInformation(contingency)).toBeCloseTo(1, 10);
  });

  test("relabelling communities does not change the score", () => {
    const relabelled = contingencyOf(
      [
        ["a", "b"],
        ["c", "d"],
      ],
      [
        ["c", "d"],
        ["a", "b"],
      ]
    );
    expect(normalizedMutualInformation(relabelled)).toBeCloseTo(1, 10);
  });

  test("two single-community partitions agree completely", () => {
    const contingency = contingencyOf([["a", "b", "c"]], [["a", "b", "c"]]);
    expect(normalizedMutualInformation(contingency)).toBe(1);
  });

  test("stays within [0, 1] for a partial split", () => {
    const contingency = contingencyOf(
      [["a", "b", "c", "d"]],
      [
        ["a", "b"],
        ["c", "d"],
      ]
    );
    const nmi = normalizedMutualInformation(contingency) as number;
    expect(nmi).toBeGreaterThanOrEqual(0);
    expect(nmi).toBeLessThanOrEqual(1);
  });

  test("an empty overlap is undefined", () => {
    expect(
      normalizedMutualInformation(contingencyOf([["a"]], [["b"]]))
    ).toBeNull();
  });
});

describe("matchCommunities", () => {
  test("pairs communities by largest overlap, one to one", () => {
    const contingency = contingencyOf(
      [
        ["a", "b", "c"],
        ["d", "e"],
      ],
      [
        ["d", "e"],
        ["a", "b", "c"],
      ]
    );
    const mapping = matchCommunities(contingency);
    expect(mapping.get(0)).toBe(1);
    expect(mapping.get(1)).toBe(0);
  });
});

describe("buildSpread", () => {
  test("reports fan-out for a split and fan-in for a merge", () => {
    const split = contingencyOf(
      [["a", "b", "c", "d"]],
      [
        ["a", "b"],
        ["c", "d"],
      ]
    );
    expect(buildSpread(split).prevFanOut.get(0)).toBe(2);

    const merge = contingencyOf(
      [
        ["a", "b"],
        ["c", "d"],
      ],
      [["a", "b", "c", "d"]]
    );
    expect(buildSpread(merge).currFanIn.get(0)).toBe(2);
  });
});

describe("comparePartitions", () => {
  test("a relabelled but identical partition agrees fully", () => {
    const result = comparePartitions(
      {
        partitions: [
          ["a", "b"],
          ["c", "d"],
        ],
      },
      {
        partitions: [
          ["c", "d"],
          ["a", "b"],
        ],
      }
    );

    expect(result.agreementPercent).toBe(100);
    expect(result.disagreements).toEqual([]);
    expect(result.ari).toBeCloseTo(1, 10);
    expect(result.nmi).toBeCloseTo(1, 10);
  });

  test("a split community is labelled as split, and ARI stays high", () => {
    const result = comparePartitions(
      {
        partitions: [
          ["a", "b", "c", "d"],
          ["e", "f"],
        ],
      },
      {
        partitions: [
          ["a", "b"],
          ["c", "d"],
          ["e", "f"],
        ],
      }
    );

    const changeTypes = new Set(
      result.disagreements.map((row) => row.changeType)
    );
    expect(changeTypes).toEqual(new Set(["split"]));
    // Members of the split half disagree, yet the structure is mostly intact.
    expect(result.agreementPercent).toBeLessThan(100);
    expect(result.ari as number).toBeGreaterThan(0.4);
  });

  test("a merged community is labelled as merged", () => {
    const result = comparePartitions(
      {
        partitions: [
          ["a", "b"],
          ["c", "d"],
        ],
      },
      { partitions: [["a", "b", "c", "d"]] }
    );

    expect(
      result.disagreements.every((row) => row.changeType === "merged")
    ).toBe(true);
  });

  test("nodes missing from the current run are flagged without skewing agreement", () => {
    const result = comparePartitions(
      { partitions: [["a", "b", "removed"]] },
      { partitions: [["a", "b"]] }
    );

    expect(result.totalCompared).toBe(2);
    expect(result.agreementPercent).toBe(100);
    expect(result.disagreements).toEqual([
      {
        node: "removed",
        prevCommunity: 0,
        currCommunity: -1,
        matchedPrevCommunity: 0,
        changeType: "vanished",
      },
    ]);
  });

  test("empty partitions do not throw", () => {
    const result = comparePartitions({ partitions: [] }, { partitions: [] });
    expect(result.totalCompared).toBe(0);
    expect(result.agreementPercent).toBe(0);
    expect(result.ari).toBeNull();
  });
});
