import type { ColorMap } from "~/igraph/types";

/** One discrete reveal step for cumulative layer-slice preview. */
export type SliceStep = {
  index: number;
  /** Kuzu node IDs revealed at this step. */
  nodes: string[];
  /** Edge keys `"fromId-toId"` revealed at this step. */
  edges: string[];
  label?: string;
};

export type LayerSliceState = {
  active: boolean;
  /** Inclusive upper bound into `steps` (show union of steps[0..currentIndex]). */
  currentIndex: number;
  steps: SliceStep[];
};

export type SliceContext = {
  /** Display label (`${primaryKey} (${tableName})`) → Kuzu node ID. */
  labelToId: Map<string, string>;
};

export type BuildSliceStepsFn<TData = unknown> = (
  data: TData,
  ctx: SliceContext
) => SliceStep[];

export type DerivedSliceOverlay = {
  colorMap: ColorMap;
  mode: number;
};
