import {
  completionsAtCursor,
  patternBindings,
  placeholderQuery,
  quoteIdent,
  shouldOpenCompletions,
  slotAtCursor,
  starterChips,
  tokenRangeAtCursor,
  tokenize,
} from "../../src/features/visualizer/queries/query-assist";

const graph = {
  nodeTables: [
    {
      tableName: "Stop",
      primaryKey: "label",
      properties: { stop_lat: "DOUBLE", routes: "STRING" },
    },
  ],
  edgeTables: [
    {
      tableName: "CONNECTED",
      primaryKey: "",
      properties: { weight: "INT64" },
      sourceTableName: "Stop",
      targetTableName: "Stop",
    },
  ],
  nodes: [
    {
      tableName: "Stop",
      _primaryKey: "label",
      _primaryKeyValue: "Haymarket Light Rail",
      attributes: { stop_lat: -33.88, routes: "L2" },
    },
  ],
  edges: [{ tableName: "CONNECTED", attributes: { weight: 5 } }],
};

const inserts = (code: string) =>
  completionsAtCursor(code, code.length, graph).items.map((item) => item.insert);

const opens = (code: string) =>
  shouldOpenCompletions(
    code,
    code.length,
    completionsAtCursor(code, code.length, graph).items
  );

describe("quoteIdent", () => {
  test("leaves simple names unquoted", () => {
    expect(quoteIdent("Stop")).toBe("Stop");
  });

  test("backticks names that are not simple identifiers", () => {
    expect(quoteIdent("Light Rail")).toBe("`Light Rail`");
  });
});

describe("starter templates", () => {
  test("placeholder uses the first node label", () => {
    expect(placeholderQuery(graph)).toBe("MATCH (n:Stop) RETURN n LIMIT 25");
  });

  test("placeholder falls back to Node when there are no tables", () => {
    expect(
      placeholderQuery({ nodeTables: [], edgeTables: [], nodes: [] })
    ).toBe("MATCH (n:Node) RETURN n LIMIT 25");
  });

  test("builds up to three schema chips", () => {
    const chips = starterChips(graph);
    expect(chips.map((chip) => chip.id)).toEqual([
      "match-nodes",
      "match-path",
      "match-where",
    ]);
    expect(chips[0].query).toBe("MATCH (n:Stop) RETURN n LIMIT 25");
    expect(chips[1].query).toContain("-[r:CONNECTED]->");
    expect(chips[2].query).toContain('WHERE n.label = "Haymarket Light Rail"');
  });
});

describe("tokenize", () => {
  test("keeps quoted text in a single string token", () => {
    const tokens = tokenize("WHERE a.label = 'RETURN (x)'");
    const strings = tokens.filter((token) => token.kind === "string");
    expect(strings).toHaveLength(1);
    expect(strings[0].value).toBe("'RETURN (x)'");
    expect(tokens.some((token) => token.value === "RETURN")).toBe(false);
  });

  test("marks an unterminated string", () => {
    const tokens = tokenize("WHERE a.label = 'Hay");
    const last = tokens[tokens.length - 1];
    expect(last.kind).toBe("string");
    expect(last.unterminated).toBe(true);
  });
});

describe("patternBindings", () => {
  test("maps aliases to their table names", () => {
    const code = "MATCH (a:Stop)-[r:CONNECTED]->(b)";
    const tokens = tokenize(code);
    const bindings = patternBindings(tokens, tokens.length);
    expect([...bindings.entries()]).toEqual([
      ["a", "Stop"],
      ["r", "CONNECTED"],
      ["b", null],
    ]);
  });

  test("ignores aliases that only appear inside a string", () => {
    const code = "MATCH (a:Stop) WHERE a.label = '(x:Foo)'";
    const tokens = tokenize(code);
    expect([...patternBindings(tokens, tokens.length).keys()]).toEqual(["a"]);
  });
});

describe("pattern slots", () => {
  test("after MATCH suggests a whole node pattern", () => {
    const code = "MATCH ";
    expect(inserts(code)).toContain("(n:Stop)");
    expect(opens(code)).toBe(true);
  });

  test("after ( suggests a node pattern", () => {
    const code = "MATCH (";
    expect(inserts(code)).toContain("n:Stop");
    expect(opens(code)).toBe(true);
  });

  test("after [ suggests a relationship pattern", () => {
    const code = "MATCH (n)-[";
    expect(inserts(code)).toContain("r:CONNECTED");
    expect(opens(code)).toBe(true);
  });

  test("after { suggests properties with a trailing colon", () => {
    const code = "MATCH (n:Stop {";
    expect(inserts(code)).toContain("label:");
    expect(opens(code)).toBe(true);
  });

  test("after - suggests an outgoing relationship snippet", () => {
    const code = "MATCH (n)-";
    expect(inserts(code)).toContain("[r:CONNECTED]->");
    expect(opens(code)).toBe(true);
  });

  test("after -> skips an already used node alias", () => {
    const code = "MATCH (n)-[r:CONNECTED]->";
    expect(inserts(code)).toContain("(n1:Stop)");
    expect(inserts(code)).not.toContain("(n:Stop)");
  });

  test("colon inside () offers node labels only", () => {
    const code = "MATCH (n:";
    expect(inserts(code)).toEqual(["Stop"]);
  });

  test("colon inside [] offers edge labels only", () => {
    const code = "MATCH (n)-[r:";
    expect(inserts(code)).toEqual(["CONNECTED"]);
  });

  test("numbers node aliases when multiple tables are offered", () => {
    const twoNodes = {
      ...graph,
      nodeTables: [
        ...graph.nodeTables,
        { tableName: "Other", primaryKey: "id", properties: {} },
      ],
    };
    const code = "MATCH (";
    const items = completionsAtCursor(code, code.length, twoNodes).items;
    expect(items.map((item) => item.insert)).toEqual(
      expect.arrayContaining(["n:Stop", "n1:Other"])
    );
  });

  test("numbers relationship aliases when r is already used", () => {
    const twoEdges = {
      ...graph,
      edgeTables: [
        ...graph.edgeTables,
        {
          tableName: "NEXT",
          primaryKey: "",
          properties: {},
          sourceTableName: "Stop",
          targetTableName: "Stop",
        },
      ],
    };
    const code = "MATCH (n)-[r:CONNECTED]->(n1)-[";
    const items = completionsAtCursor(code, code.length, twoEdges).items;
    expect(items.map((item) => item.insert)).toEqual(
      expect.arrayContaining(["r1:CONNECTED", "r2:NEXT"])
    );
    expect(items.map((item) => item.insert)).not.toContain("r:CONNECTED");
  });
});

describe("predicate slots", () => {
  test("after WHERE offers bound aliases", () => {
    const code = "MATCH (a:Stop) WHERE ";
    expect(inserts(code)).toEqual(["a"]);
    expect(opens(code)).toBe(true);
  });

  test("after a dot offers only that alias's properties", () => {
    const code = "MATCH (a:Stop)-[r:CONNECTED]->(b) WHERE a.";
    expect(inserts(code)).toEqual(["label", "stop_lat", "routes"]);
    expect(inserts(code)).not.toContain("weight");
  });

  test("an unbound alias falls back to every property", () => {
    const code = "RETURN n.";
    const items = completionsAtCursor(code, code.length, graph).items;
    expect(items.every((item) => item.kind === "property")).toBe(true);
    expect(items.map((item) => item.insert)).toEqual(
      expect.arrayContaining(["label", "stop_lat", "routes", "weight"])
    );
  });

  test("after a property offers comparison operators", () => {
    const code = "MATCH (a:Stop) WHERE a.label ";
    expect(inserts(code)).toEqual(expect.arrayContaining(["=", "CONTAINS"]));
    expect(opens(code)).toBe(true);
  });

  test("CONTAINS completes from an operator prefix", () => {
    const code = "MATCH (a:Stop) WHERE a.routes CON";
    expect(inserts(code)).toEqual(["CONTAINS"]);
  });

  test("after an operator offers real node values", () => {
    const code = "MATCH (a:Stop) WHERE a.label = ";
    expect(inserts(code)).toEqual(['"Haymarket Light Rail"']);
    expect(opens(code)).toBe(true);
  });

  test("after an operator offers real edge values", () => {
    const code = "MATCH ()-[r:CONNECTED]->() WHERE r.weight = ";
    expect(inserts(code)).toEqual(["5"]);
  });

  test("STARTS is followed by WITH", () => {
    const code = "MATCH (a:Stop) WHERE a.label STARTS ";
    expect(inserts(code)).toEqual(["WITH"]);
  });

  test("IS is followed by NULL", () => {
    const code = "MATCH (a:Stop) WHERE a.label IS ";
    expect(inserts(code)).toEqual(["NULL", "NOT NULL"]);
  });

  test("a string in the predicate does not leak aliases or clauses", () => {
    const code = "MATCH (a:Stop) WHERE a.label = '(x:Foo) RETURN x' AND ";
    expect(inserts(code)).toEqual(["a"]);
  });
});

describe("projection slots", () => {
  test("after RETURN prefers bound pattern aliases", () => {
    const code = "MATCH (n:Stop)-[r:CONNECTED]->(n1:Stop) RETURN ";
    const items = completionsAtCursor(code, code.length, graph).items;
    expect(items.slice(0, 3).map((item) => item.insert)).toEqual([
      "n",
      "r",
      "n1",
    ]);
    expect(items.slice(0, 3).every((item) => item.kind === "variable")).toBe(
      true
    );
    expect(opens(code)).toBe(true);
  });

  test("RETURN prefix n only completes matching aliases", () => {
    const code = "MATCH (n:Stop)-[r:CONNECTED]->(n1:Stop) RETURN n";
    const items = completionsAtCursor(code, code.length, graph).items;
    expect(items.map((item) => item.insert)).toEqual(
      expect.arrayContaining(["n", "n1"])
    );
    expect(items.some((item) => item.kind === "keyword")).toBe(false);
  });

  test("after a RETURN comma omits aliases already listed", () => {
    const code = "MATCH (n:Stop)-[r:CONNECTED]->(n1:Stop) RETURN n, ";
    const items = completionsAtCursor(code, code.length, graph).items;
    expect(items.map((item) => item.insert)).toEqual(
      expect.arrayContaining(["r", "n1"])
    );
    expect(items.map((item) => item.insert)).not.toContain("n");
    expect(items.some((item) => item.kind === "keyword")).toBe(false);
    expect(opens(code)).toBe(true);
  });
});

describe("closed contexts", () => {
  test("does not open on an empty document", () => {
    expect(opens("")).toBe(false);
  });

  test("does not open after a completed pattern", () => {
    expect(opens("MATCH (n:Stop) ")).toBe(false);
  });

  test("does not open after a closing quote", () => {
    const code = "MATCH (a:Stop) WHERE a.routes CONTAINS 'L3'";
    expect(slotAtCursor(code, code.length).slot).toBe("continuation");
    expect(opens(code)).toBe(false);
  });

  test("does not open inside a string", () => {
    const code = "MATCH (a:Stop) WHERE a.label = 'Hay";
    expect(slotAtCursor(code, code.length).slot).toBe("none");
    expect(opens(code)).toBe(false);
  });

  test("does not open inside a comment", () => {
    const code = "MATCH (a:Stop) // note ";
    expect(slotAtCursor(code, code.length).slot).toBe("none");
    expect(opens(code)).toBe(false);
  });

  test("still completes continuation keywords from a prefix", () => {
    const code = "MATCH (a:Stop) WHERE a.routes CONTAINS 'L3' AN";
    expect(inserts(code)).toEqual(["AND"]);
    expect(opens(code)).toBe(true);
  });
});

describe("clause slot", () => {
  test("filters clause heads by prefix", () => {
    const result = completionsAtCursor("MA", 2, graph);
    expect(result.from).toBe(0);
    expect(result.items.map((item) => item.insert)).toContain("MATCH");
    expect(result.items.some((item) => item.insert === "RETURN")).toBe(false);
  });

  test("tokenRangeAtCursor walks back the current identifier", () => {
    expect(tokenRangeAtCursor("MATCH (n:St", 11)).toEqual({
      from: 9,
      to: 11,
      prefix: "St",
    });
  });
});
