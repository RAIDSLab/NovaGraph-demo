import type { DerivedSliceOverlay, SliceStep } from "./types";

import { MODE, type ColorMap } from "~/igraph/types";

/**
 * Build a cumulative colorMap from steps[0..currentIndex].
 * Earlier first-seen steps get higher node values; edges are fully highlighted.
 */
export function deriveSliceColorMap(
  steps: SliceStep[],
  currentIndex: number
): DerivedSliceOverlay {
  const colorMap: ColorMap = {};
  if (steps.length === 0) {
    return { colorMap, mode: MODE.COLOR_SHADE_DEFAULT };
  }

  const maxIndex = Math.min(Math.max(currentIndex, 0), steps.length - 1);
  const stepCount = maxIndex + 1;

  for (let i = 0; i <= maxIndex; i++) {
    const step = steps[i];
    // Earlier steps → higher value (closer to 1). Single-step → 1.
    const nodeValue =
      stepCount === 1 ? 1 : 1 - (i / (stepCount - 1)) * 0.5;

    for (const nodeId of step.nodes) {
      if (!(nodeId in colorMap)) {
        colorMap[nodeId] = nodeValue;
      }
    }
    for (const edge of step.edges) {
      colorMap[edge] = 1;
    }
  }

  return { colorMap, mode: MODE.COLOR_SHADE_DEFAULT };
}
