import {
  classifyQueryValue,
  parseQueryRows,
} from "../../src/features/visualizer/queries/parse-query-rows";

const stopNode = {
  _id: { table: 0, offset: 5 },
  _label: "Stop",
  id: "haymarket",
  label: "Haymarket Light Rail",
};

const knowsEdge = {
  _id: { table: 1, offset: 2 },
  _label: "KNOWS",
  _src: { table: 0, offset: 5 },
  _dst: { table: 0, offset: 8 },
  since: 2019,
};

describe("classifyQueryValue", () => {
  test("classifies a Kuzu node and uses _id only for the kuzu id", () => {
    const cell = classifyQueryValue(stopNode);
    expect(cell).toEqual({
      kind: "node",
      kuzuId: "0_5",
      label: "Stop",
      raw: stopNode,
    });
  });

  test("classifies a Kuzu edge from _src/_dst", () => {
    const cell = classifyQueryValue(knowsEdge);
    expect(cell).toEqual({
      kind: "edge",
      sourceId: "0_5",
      targetId: "0_8",
      relLabel: "KNOWS",
      raw: knowsEdge,
    });
  });

  test("classifies scalars including bigint and null", () => {
    expect(classifyQueryValue("Haymarket")).toEqual({
      kind: "scalar",
      value: "Haymarket",
    });
    expect(classifyQueryValue(42)).toEqual({ kind: "scalar", value: 42 });
    expect(classifyQueryValue(true)).toEqual({ kind: "scalar", value: true });
    expect(classifyQueryValue(null)).toEqual({ kind: "scalar", value: null });
    expect(classifyQueryValue(10n)).toEqual({ kind: "scalar", value: 10n });
  });

  test("classifies nested maps, lists, and incomplete entities as json", () => {
    expect(classifyQueryValue({ nested: true }).kind).toBe("json");
    expect(classifyQueryValue([1, 2, 3]).kind).toBe("json");
    expect(classifyQueryValue({ _id: { table: 0, offset: 1 } }).kind).toBe(
      "json"
    );
  });
});

describe("parseQueryRows", () => {
  test("unions RETURN columns across rows and fills missing cells", () => {
    const parsed = parseQueryRows([{ n: stopNode }, { n: stopNode, count: 2 }]);

    expect(parsed.columns).toEqual(["n", "count"]);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].n.kind).toBe("node");
    expect(parsed.rows[0].count).toEqual({ kind: "scalar", value: null });
    expect(parsed.rows[1].count).toEqual({ kind: "scalar", value: 2 });
  });

  test("counts unique nodes and edges in the result, not duplicate rows", () => {
    const parsed = parseQueryRows([
      { n: stopNode, r: knowsEdge },
      {
        n: stopNode,
        r: {
          ...knowsEdge,
          _id: { table: 1, offset: 9 },
        },
      },
      {
        n: {
          _id: { table: 0, offset: 8 },
          _label: "Stop",
          label: "Central",
        },
        r: {
          _id: { table: 1, offset: 3 },
          _label: "KNOWS",
          _src: { table: 0, offset: 8 },
          _dst: { table: 0, offset: 5 },
        },
      },
    ]);

    expect(parsed.uniqueNodeCount).toBe(2);
    expect(parsed.uniqueEdgeCount).toBe(2);
  });
});
