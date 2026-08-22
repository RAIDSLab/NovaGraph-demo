import type { InputType } from "../inputs";

import { baselineButtonLabel, buildParamLabel, runDisplayTitle } from "./param-label";

const resolution: InputType = {
  type: "number",
  id: "resolution",
  key: "resolution",
  displayName: "Resolution",
};

const directed: InputType = {
  type: "switch",
  id: "directed",
  key: "directed",
  displayName: "Directed",
};

const startNode: InputType = {
  type: "text",
  id: "start",
  key: "start",
  displayName: "Start",
};

const payload: InputType = {
  type: "file",
  id: "file",
  key: "file",
  displayName: "File",
};

describe("buildParamLabel", () => {
  test("joins named inputs so two Louvain runs stay distinguishable", () => {
    expect(buildParamLabel([resolution], [2])).toBe("Resolution=2");
    expect(buildParamLabel([resolution, directed], [1, true])).toBe(
      "Resolution=1, Directed=on"
    );
  });

  test("skips file inputs so their contents never become a title", () => {
    expect(buildParamLabel([payload, resolution], [{}, 1.5])).toBe(
      "Resolution=1.5"
    );
  });

  test("drops empty or non-finite values", () => {
    expect(buildParamLabel([resolution, startNode], [NaN, "  "])).toBe("");
  });
});

describe("runDisplayTitle", () => {
  test("appends the parameter suffix to both previous and current labels", () => {
    expect(runDisplayTitle("Louvain Algorithm", "Resolution=1")).toBe(
      "Louvain Algorithm (Resolution=1)"
    );
    expect(runDisplayTitle("Louvain Algorithm", "Resolution=2")).toBe(
      "Louvain Algorithm (Resolution=2)"
    );
  });

  test("leaves a run with no inputs as the bare title", () => {
    expect(runDisplayTitle("Weakly Connected (WCC)", "")).toBe(
      "Weakly Connected (WCC)"
    );
  });
});

describe("baselineButtonLabel", () => {
  test("shows only params when the baseline is another run of the same algorithm", () => {
    expect(
      baselineButtonLabel(
        "Louvain Algorithm",
        "Resolution=2",
        "Louvain Algorithm"
      )
    ).toBe("Resolution=2");
  });

  test("keeps the algorithm name when the baseline is a different run title", () => {
    expect(
      baselineButtonLabel(
        "Degree Centrality",
        "",
        "Betweenness Centrality"
      )
    ).toBe("Degree Centrality");
    expect(
      baselineButtonLabel(
        "Closeness Centrality",
        "",
        "Betweenness Centrality"
      )
    ).toBe("Closeness Centrality");
  });

  test("includes params when the baseline algorithm differs from the current one", () => {
    expect(
      baselineButtonLabel(
        "Louvain Algorithm",
        "Resolution=1",
        "Leiden Algorithm"
      )
    ).toBe("Louvain Algorithm (Resolution=1)");
  });
});
