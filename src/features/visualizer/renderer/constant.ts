export const GRAVITY = {
  ZERO_GRAVITY: 0,
  LOW_GRAVITY: 0.1,
  HIGH_GRAVITY: 0.5,
} as const;
export type Gravity = (typeof GRAVITY)[keyof typeof GRAVITY];

export const NODE_SIZE_SCALE = {
  INVISIBLE: 0,
  EXTRA_SMALL: 0.25,
  SMALL: 0.5,
  MEDIUM: 1,
  LARGE: 1.5,
  EXTRA_LARGE: 2,
} as const;
export type NodeSizeScale =
  (typeof NODE_SIZE_SCALE)[keyof typeof NODE_SIZE_SCALE];

// Simulation defaults: Cosmograph's internal decay default is 1000; we used to
// pin it at 100000 which kept the simulation effectively running forever and
// burned CPU/GPU long after the layout had settled. 5000 still gives a smooth
// settle while letting `onSimulationEnd` actually fire.
export const SIMULATION_DEFAULTS = {
  LINK_DISTANCE: 20,
  LINK_SPRING: 0.02,
  DECAY: 5000,
  REPULSION: 2,
} as const;

// LOD-related rendering defaults. Tuned so that the default view stays
// readable on dense graphs without removing any data.
export const RENDER_DEFAULTS = {
  INITIAL_ZOOM_LEVEL: 1,
  LINK_VISIBILITY_DISTANCE_RANGE: [40, 120] as [number, number],
  LINK_VISIBILITY_MIN_TRANSPARENCY: 0.25,
  LINK_GREYOUT_OPACITY: 0.05,
  NODE_GREYOUT_OPACITY: 0.1,
  PIXEL_RATIO_CAP: 2,
  // When edges exceed this threshold the renderer starts in a paused state
  // and dynamic labels are off by default, so the initial frame is light.
  LARGE_GRAPH_EDGE_THRESHOLD: 5000,
} as const;

export type LinkVisibilityDistanceRange = readonly [number, number];

/** User-configurable render/simulation options (Graph Options sidebar). */
export type GraphRenderSettings = {
  largeGraphEdgeThreshold: number;
  defaultShowDynamicLabels: boolean;
  linkVisibilityDistanceRange: LinkVisibilityDistanceRange;
  simulationDecay: number;
  autoPauseOnSimulationEnd: boolean;
};

export const DEFAULT_GRAPH_RENDER_SETTINGS: GraphRenderSettings = {
  largeGraphEdgeThreshold: RENDER_DEFAULTS.LARGE_GRAPH_EDGE_THRESHOLD,
  defaultShowDynamicLabels: true,
  linkVisibilityDistanceRange: RENDER_DEFAULTS.LINK_VISIBILITY_DISTANCE_RANGE,
  simulationDecay: SIMULATION_DEFAULTS.DECAY,
  autoPauseOnSimulationEnd: true,
};
