import type { CosmographRef } from "@cosmograph/react";
import { useCallback } from "react";

import type { GraphEdge, GraphNode } from "../../types";
import { useStore } from "../../hooks/use-store";

const ZOOM_DURATION = 500;
const ZOOM_FACTOR = 1.5;
const SMALLEST_ZOOM_LEVEL = 0.1;

type CosmographInstance = CosmographRef<GraphNode, GraphEdge>;

const resolveZoomLevel = (graph: CosmographInstance | null | undefined) => {
  const zoomLevel = graph?.getZoomLevel();
  return typeof zoomLevel === "number" && Number.isFinite(zoomLevel)
    ? zoomLevel
    : null;
};

export const useZoomControls = (
  getCosmograph: () => CosmographInstance | null | undefined
) => {
  const store = useStore();

  const fitToScreen = useCallback(() => {
    const graph = getCosmograph();
    const nodes = store.database?.graph.nodes;
    if (!graph || !nodes?.length) return;

    if (nodes.length === 1) {
      graph.zoomToNode(nodes[0]);
      return;
    }

    graph.unselectNodes();
    graph.fitView(ZOOM_DURATION);
  }, [getCosmograph, store.database?.graph.nodes]);

  const zoomToNode = useCallback(
    (node: GraphNode | null | undefined) => {
      const graph = getCosmograph();
      if (node && graph) {
        graph.selectNode(node, true);
        graph.zoomToNode(node);
      } else {
        fitToScreen();
      }
    },
    [getCosmograph, fitToScreen]
  );

  const zoomIn = useCallback(() => {
    const graph = getCosmograph();
    if (!graph) return;
    const zoomLevel = resolveZoomLevel(graph) ?? 1;
    graph.setZoomLevel(zoomLevel * ZOOM_FACTOR, ZOOM_DURATION);
  }, [getCosmograph]);

  const zoomOut = useCallback(() => {
    const graph = getCosmograph();
    if (!graph) return;
    const zoomLevel = resolveZoomLevel(graph) ?? 1;
    graph.setZoomLevel(
      Math.max(SMALLEST_ZOOM_LEVEL, zoomLevel / ZOOM_FACTOR),
      ZOOM_DURATION
    );
  }, [getCosmograph]);

  return { fitToScreen, zoomToNode, zoomIn, zoomOut };
};
