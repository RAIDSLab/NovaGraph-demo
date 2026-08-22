import {
  agreedPartitionNodes,
  buildNodeScoreDiffOverlay,
  buildPartitionDiffOverlay,
  rankMoveThreshold,
} from "./diff-overlay";
import { shortNodeLabel } from "./labels";
import { compareNodeScores } from "./node-score";
import { comparePartitions } from "./partition";

const scores = (entries: [string, number][]) =>
  entries.map(([node, score]) => ({ node, score }));

/** Labels here double as ids so the mapping stays easy to read. */
const identityMap = (labels: string[]) =>
  new Map(labels.map((label) => [label, `id:${label}`]));

describe("rankMoveThreshold", () => {
  test("never drops below one position", () => {
    expect(rankMoveThreshold(0)).toBe(1);
    expect(rankMoveThreshold(5)).toBe(1);
  });

  test("scales with the population so large graphs stay readable", () => {
    expect(rankMoveThreshold(100)).toBe(5);
  });
});

describe("buildNodeScoreDiffOverlay", () => {
  test("splits nodes into climbed, fell and unchanged", () => {
    const labels = ["a", "b", "c", "d", "e"];
    // 'a' falls from 1st to 5th and 'e' climbs from 5th to 1st; the threshold
    // for five nodes is one position, so the middle three barely move.
    const result = compareNodeScores(
      scores([
        ["a", 50],
        ["b", 40],
        ["c", 30],
        ["d", 20],
        ["e", 10],
      ]),
      scores([
        ["a", 10],
        ["b", 20],
        ["c", 30],
        ["d", 40],
        ["e", 50],
      ])
    );

    const overlay = buildNodeScoreDiffOverlay(result, identityMap(labels));

    expect(overlay.categories["id:a"]).toBe("down");
    expect(overlay.categories["id:e"]).toBe("up");
    expect(overlay.categories["id:c"]).toBe("stable");
    expect(overlay.counts.up).toBe(2);
    expect(overlay.counts.down).toBe(2);
    expect(overlay.counts.stable).toBe(1);
  });

  test("a node present in only one run is marked missing", () => {
    const result = compareNodeScores(
      scores([["a", 1]]),
      scores([
        ["a", 1],
        ["newcomer", 5],
      ])
    );

    const overlay = buildNodeScoreDiffOverlay(
      result,
      identityMap(["a", "newcomer"])
    );

    expect(overlay.categories["id:newcomer"]).toBe("missing");
  });

  test("labels absent from the graph are reported, not coloured", () => {
    const result = compareNodeScores(
      scores([
        ["a", 1],
        ["deleted", 2],
      ]),
      scores([
        ["a", 1],
        ["deleted", 2],
      ])
    );

    const overlay = buildNodeScoreDiffOverlay(result, identityMap(["a"]));

    expect(overlay.missingLabels).toEqual(["deleted"]);
    expect(Object.keys(overlay.categories)).toEqual(["id:a"]);
  });
});

describe("buildPartitionDiffOverlay", () => {
  test("agreeing nodes are stable and moved nodes are changed", () => {
    const previous = [
      ["a", "b"],
      ["c", "d"],
    ];
    const result = comparePartitions(
      { partitions: previous },
      {
        partitions: [["a", "b", "c"], ["d"]],
      }
    );

    const overlay = buildPartitionDiffOverlay(
      result,
      agreedPartitionNodes(previous, result),
      identityMap(["a", "b", "c", "d"])
    );

    expect(overlay.categories["id:a"]).toBe("stable");
    expect(overlay.categories["id:b"]).toBe("stable");
    expect(overlay.categories["id:c"]).toBe("changed");
    expect(overlay.counts.stable + overlay.counts.changed).toBe(4);
  });

  test("a node dropped from the current run is marked missing", () => {
    const previous = [["a", "b", "removed"]];
    const result = comparePartitions(
      { partitions: previous },
      { partitions: [["a", "b"]] }
    );

    const overlay = buildPartitionDiffOverlay(
      result,
      agreedPartitionNodes(previous, result),
      identityMap(["a", "b", "removed"])
    );

    expect(overlay.categories["id:removed"]).toBe("missing");
    expect(overlay.counts.missing).toBe(1);
  });
});

describe("agreedPartitionNodes", () => {
  test("returns every node not listed as a disagreement", () => {
    const previous = [["a", "b"], ["c"]];
    const result = comparePartitions(
      { partitions: previous },
      {
        partitions: [["a", "b"], ["c"]],
      }
    );
    expect(agreedPartitionNodes(previous, result).sort()).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});

describe("shortNodeLabel", () => {
  test("drops the trailing table qualifier", () => {
    expect(shortNodeLabel("haymarket (Stop)")).toBe("haymarket");
  });

  test("keeps keys that contain spaces", () => {
    expect(shortNodeLabel("Central Station (Stop)")).toBe("Central Station");
  });

  test("leaves an unqualified label alone", () => {
    expect(shortNodeLabel("a1")).toBe("a1");
  });
});
