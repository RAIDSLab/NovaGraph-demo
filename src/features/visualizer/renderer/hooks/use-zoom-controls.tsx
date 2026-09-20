import type { CosmographRef } from "@cosmograph/react";
import { useCallback } from "react";

import type { GraphEdge, GraphNode } from "../../types";
import { useStore } from "../../hooks/use-store";

const ZOOM_FACTOR = 1.5;
const SMALLEST_ZOOM_LEVEL = 0.1;

type CosmographInstance = CosmographRef<GraphNode, GraphEdge>;

type CosmosZoom = {
  getZoomLevel: () => number;
  setZoomLevel: (value: number, duration?: number) => void;
  fitView: (duration?: number, padding?: number) => void;
  getNodePositionsArray: () => ([number, number] | undefined)[];
  zoomInstance: {
    getTransform: (
      positions: [number, number][],
      scale?: number,
      padding?: number
    ) => unknown;
    behavior: { scaleBy: unknown; transform: unknown };
  };
  canvasD3Selection: {
    call: (behavior: unknown, value: unknown) => void;
  };
};

const asCosmos = (
  graph: CosmographInstance | null | undefined
): CosmosZoom | null => {
  const cosmos = graph?.cosmos as CosmosZoom | undefined;
  if (!cosmos?.canvasD3Selection || !cosmos.zoomInstance?.behavior) return null;
  const node =
    typeof (cosmos.canvasD3Selection as { node?: () => Node | null }).node ===
    "function"
      ? (cosmos.canvasD3Selection as { node: () => Node | null }).node()
      : null;
  if (node instanceof HTMLCanvasElement && !node.isConnected) return null;
  return cosmos;
};

const finitePositions = (positions: ([number, number] | undefined)[]) =>
  positions.filter(
    (point): point is [number, number] =>
      Array.isArray(point) &&
      Number.isFinite(point[0]) &&
      Number.isFinite(point[1])
  );

const getVisualizerCanvas = () => {
  const scoped = document.querySelector("[data-guide='canvas'] canvas");
  if (scoped instanceof HTMLCanvasElement && scoped.isConnected) return scoped;
  const fallback = document.querySelector("main canvas");
  return fallback instanceof HTMLCanvasElement && fallback.isConnected
    ? fallback
    : null;
};

const getGraphFromCanvas = (canvas: HTMLCanvasElement) => {
  const host = canvas.parentElement;
  if (!host) return null;
  const fiberKey = Object.keys(host).find((key) =>
    key.startsWith("__reactFiber")
  );
  if (!fiberKey) return null;
  const hostFiber = (
    host as unknown as Record<
      string,
      {
        return?: {
          memoizedState?: {
            next?: { memoizedState?: { current?: CosmographInstance } };
          };
        };
      }
    >
  )[fiberKey];
  return hostFiber?.return?.memoizedState?.next?.memoizedState?.current ?? null;
};

const zoomCanvasByWheel = (direction: "in" | "out") => {
  const canvas = getVisualizerCanvas();
  if (!canvas) return false;
  const rect = canvas.getBoundingClientRect();
  canvas.dispatchEvent(
    new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      deltaY: direction === "in" ? -140 : 140,
      deltaMode: 0,
    })
  );
  return true;
};

const scaleBy = (graph: CosmographInstance | null, factor: number) => {
  const cosmos = asCosmos(graph);
  if (cosmos) {
    cosmos.canvasD3Selection.call(
      cosmos.zoomInstance.behavior.scaleBy,
      factor
    );
    return true;
  }
  if (graph) {
    const current = graph.getZoomLevel();
    const zoomLevel =
      typeof current === "number" && Number.isFinite(current) && current > 0
        ? current
        : 1;
    graph.setZoomLevel(zoomLevel * factor, 0);
    return true;
  }
  return false;
};

const fitInstantly = (graph: CosmographInstance) => {
  const cosmos = asCosmos(graph);
  if (cosmos) {
    const positions = finitePositions(cosmos.getNodePositionsArray());
    if (positions.length > 0) {
      const transform = cosmos.zoomInstance.getTransform(
        positions,
        undefined,
        0.1
      );
      cosmos.canvasD3Selection.call(
        cosmos.zoomInstance.behavior.transform,
        transform
      );
      return;
    }
  }
  graph.fitView(0);
};

const resolveGraph = (
  getCosmograph: () => CosmographInstance | null | undefined
) => {
  const fromGetter = getCosmograph();
  if (asCosmos(fromGetter) || fromGetter) return fromGetter ?? null;
  const canvas = getVisualizerCanvas();
  return canvas ? getGraphFromCanvas(canvas) : null;
};

export const useZoomControls = (
  getCosmograph: () => CosmographInstance | null | undefined
) => {
  const store = useStore();

  const fitToScreen = useCallback(() => {
    const graph = resolveGraph(getCosmograph);
    if (!graph) return;
    const nodes = graph.data?.nodes ?? store.database?.graph.nodes;
    if (!nodes?.length) return;

    if (nodes.length === 1) {
      graph.zoomToNode(nodes[0]);
      return;
    }

    fitInstantly(graph);
  }, [getCosmograph, store.database?.graph.nodes]);

  const zoomToNode = useCallback(
    (node: GraphNode | null | undefined) => {
      const graph = resolveGraph(getCosmograph);
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
    const graph = resolveGraph(getCosmograph);
    scaleBy(graph, ZOOM_FACTOR);
    zoomCanvasByWheel("in");
  }, [getCosmograph]);

  const zoomOut = useCallback(() => {
    const graph = resolveGraph(getCosmograph);
    const cosmos = asCosmos(graph);
    const current = cosmos?.getZoomLevel() ?? graph?.getZoomLevel();
    const zoomLevel =
      typeof current === "number" && Number.isFinite(current) && current > 0
        ? current
        : 1;
    const nextFactor = Math.max(
      SMALLEST_ZOOM_LEVEL / zoomLevel,
      1 / ZOOM_FACTOR
    );
    scaleBy(graph, nextFactor);
    zoomCanvasByWheel("out");
  }, [getCosmograph]);

  return { fitToScreen, zoomToNode, zoomIn, zoomOut };
};
