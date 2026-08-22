import { shouldBumpGraphRevision } from "./graph-revision";

const sameGraph = {
  previousNodeCount: 17,
  previousEdgeCount: 40,
  nextNodeCount: 17,
  nextEdgeCount: 40,
};

describe("shouldBumpGraphRevision", () => {
  test("does not bump when switching databases", () => {
    expect(
      shouldBumpGraphRevision({
        previousDatabaseName: "alpha",
        nextDatabaseName: "beta",
        previousNodeCount: 17,
        previousEdgeCount: 40,
        nextNodeCount: 3,
        nextEdgeCount: 2,
      })
    ).toBe(false);
  });

  test("does not bump when switching back to a database with the same size", () => {
    expect(
      shouldBumpGraphRevision({
        previousDatabaseName: "beta",
        nextDatabaseName: "alpha",
        ...sameGraph,
      })
    ).toBe(false);
  });

  test("does not bump a same-database refresh that did not change topology", () => {
    expect(
      shouldBumpGraphRevision({
        previousDatabaseName: "alpha",
        nextDatabaseName: "alpha",
        ...sameGraph,
      })
    ).toBe(false);
  });

  test("bumps when the same database lost or gained nodes or edges", () => {
    expect(
      shouldBumpGraphRevision({
        previousDatabaseName: "alpha",
        nextDatabaseName: "alpha",
        previousNodeCount: 17,
        previousEdgeCount: 40,
        nextNodeCount: 16,
        nextEdgeCount: 40,
      })
    ).toBe(true);
    expect(
      shouldBumpGraphRevision({
        previousDatabaseName: "alpha",
        nextDatabaseName: "alpha",
        previousNodeCount: 17,
        previousEdgeCount: 40,
        nextNodeCount: 17,
        nextEdgeCount: 39,
      })
    ).toBe(true);
  });

  test("does not bump when there is no current database", () => {
    expect(
      shouldBumpGraphRevision({
        previousDatabaseName: "alpha",
        nextDatabaseName: null,
        previousNodeCount: 17,
        previousEdgeCount: 40,
        nextNodeCount: 0,
        nextEdgeCount: 0,
      })
    ).toBe(false);
  });
});
