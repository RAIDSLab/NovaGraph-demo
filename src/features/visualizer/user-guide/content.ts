export const TOUR_SEEN_KEY = "novagraph.user-guide.tour-seen";

export type GuideAction =
  | "start-tour"
  | "open-import"
  | "open-create-node"
  | "open-algorithms"
  | "open-settings"
  | "open-output"
  | "close-guide";

export type GuideSectionId =
  | "start"
  | "import"
  | "build"
  | "canvas"
  | "algorithms"
  | "query"
  | "export"
  | "settings";

export type GuideSection = {
  id: GuideSectionId;
  title: string;
  keywords: string[];
  body: string[];
  cta?: { label: string; action: GuideAction };
};

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "start",
    title: "Getting Started",
    keywords: ["tour", "overview", "layout", "workspace", "help"],
    body: [
      "NovaGraph is a local-first graph workspace: import or build a graph, run an algorithm, and read the result on the canvas.",
      "Left: algorithms. Center: graph canvas. Right: Graph Options. Bottom: Code/Output.",
      "Nothing leaves this browser tab. Take the tour once to see each control in place.",
    ],
    cta: { label: "Take a tour", action: "start-tour" },
  },
  {
    id: "import",
    title: "Import and workspaces",
    keywords: [
      "csv",
      "json",
      "txt",
      "graphml",
      "gexf",
      "auto",
      "database",
      "workspace",
      "directed",
      "persistent",
      "in-memory",
    ],
    body: [
      "Open Database at the top-left of the canvas to switch workspaces or create a graph.",
      "Import CSV, JSON, TXT, GraphML, or GEXF, or use Auto to generate a sample graph.",
      "Directed Graph controls whether edges have direction. Persistent workspaces survive a refresh on this device; in-memory graphs do not.",
    ],
    cta: { label: "Open Import", action: "open-import" },
  },
  {
    id: "build",
    title: "Build a graph",
    keywords: ["node", "edge", "schema", "create", "edit", "attributes"],
    body: [
      "Use + Node to add a typed node. If no node table exists yet, you will define a schema first.",
      "Click a node on the canvas to edit attributes, add edges, or delete it.",
      "On an undirected graph, edge creation does not emphasize from/to direction.",
    ],
    cta: { label: "Open Create Node", action: "open-create-node" },
  },
  {
    id: "canvas",
    title: "Canvas",
    keywords: ["zoom", "labels", "pause", "simulation", "search", "layout"],
    body: [
      "The canvas is a force-directed WebGL view. Pause, restart, fit, zoom, and toggle labels from the footer.",
      "Search in the top-right jumps to a node by its label.",
      "Large graphs may load paused with labels off. Adjust that threshold in Graph Options.",
    ],
    cta: { label: "Got it", action: "close-guide" },
  },
  {
    id: "algorithms",
    title: "Algorithms",
    keywords: [
      "pagerank",
      "bfs",
      "dfs",
      "dijkstra",
      "community",
      "centrality",
      "path",
      "compare",
    ],
    body: [
      "The left sidebar groups traversal, path finding, centrality, community detection, and similarity.",
      "Pick an algorithm, fill any inputs, and run it. Results color and size the graph and fill the Output table.",
      "Compare keeps recent runs so you can diff scores or partitions against a baseline.",
    ],
    cta: { label: "Open algorithm sidebar", action: "open-algorithms" },
  },
  {
    id: "query",
    title: "Query",
    keywords: ["cypher", "cli", "code", "sql", "kuzu", "query"],
    body: [
      "The bottom panel is optional. Expand Show Code/Output to inspect algorithm tables or run a query.",
      "The Code tab (Kuzu Cypher / CLI) is available only on persistent workspaces.",
      "In-memory graphs still show Output after an algorithm run; they do not execute queries.",
    ],
    cta: { label: "Open Code/Output", action: "open-output" },
  },
  {
    id: "export",
    title: "Export",
    keywords: ["json", "yaml", "download", "results", "save"],
    body: [
      "After an algorithm (or query) produces Output, use Export Results to download JSON or YAML.",
      "Export writes the current result table, not a full workspace dump.",
      "Open the bottom panel first if Output is collapsed.",
    ],
    cta: { label: "Open Code/Output", action: "open-output" },
  },
  {
    id: "settings",
    title: "Settings",
    keywords: [
      "gravity",
      "node size",
      "lod",
      "labels",
      "performance",
      "options",
    ],
    body: [
      "Graph Options on the right controls layout gravity, node size, link visibility, and large-graph behavior.",
      "These change how the canvas looks, not the stored graph.",
      "The panel starts closed; open it from the chevron on the right edge.",
    ],
    cta: { label: "Open Graph Options", action: "open-settings" },
  },
];

export type TourPlacement = "right" | "left" | "bottom";

export type TourPanelLayout = {
  algorithms?: boolean;
  settings?: boolean;
  output?: boolean;
};

export const DEFAULT_TOUR_PANEL_LAYOUT = {
  algorithms: true,
  settings: false,
  output: false,
} as const satisfies Required<TourPanelLayout>;

export const resolveTourPanelLayout = (
  prepare?: TourPanelLayout
): Required<TourPanelLayout> => ({
  algorithms: prepare?.algorithms ?? DEFAULT_TOUR_PANEL_LAYOUT.algorithms,
  settings: prepare?.settings ?? DEFAULT_TOUR_PANEL_LAYOUT.settings,
  output: prepare?.output ?? DEFAULT_TOUR_PANEL_LAYOUT.output,
});

export type TourStep = {
  id: string;
  title: string;
  body: string;
  selector: string;
  placement: TourPlacement;
  prepare?: TourPanelLayout;
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: "import",
    title: "Import or switch a workspace",
    body: "Open Database to import CSV, JSON, GraphML, GEXF, or a generated graph, and to switch local workspaces.",
    selector: '[data-guide="import"]',
    placement: "right",
  },
  {
    id: "algorithms",
    title: "Run an algorithm",
    body: "Choose a built-in algorithm here. Results map onto node color, size, and the Output table — no code required.",
    selector: '[data-guide="algorithms"]',
    placement: "right",
  },
  {
    id: "canvas",
    title: "Explore the canvas",
    body: "Pause the layout, fit the graph, zoom, and toggle labels. Search in the top-right finds a node by label.",
    selector: '[data-guide="canvas"]',
    placement: "bottom",
  },
  {
    id: "settings",
    title: "Tune Graph Options",
    body: "Gravity, node size, and large-graph defaults live here. They only affect the view.",
    selector: '[data-guide="settings"]',
    placement: "left",
    prepare: { settings: true },
  },
  {
    id: "output",
    title: "Read Code and Output",
    body: "Algorithm tables and optional Cypher live in this drawer. Export JSON or YAML from Output after a run.",
    selector: '[data-guide="output"]',
    placement: "bottom",
    prepare: { output: true },
  },
  {
    id: "user-guide",
    title: "Reopen this guide anytime",
    body: "User Guide in the header, or press ?, opens the handbook. You can replay this tour from Getting Started.",
    selector: '[data-guide="user-guide"]',
    placement: "left",
  },
];
