import type { CosmographRef } from "@cosmograph/react";
import { useCallback } from "react";

import type { GraphEdge, GraphNode } from "../../types";
import { useStore } from "../../hooks/use-store";

const ZOOM_FACTOR = 1.5;
const SMALLEST_ZOOM_LEVEL = 0.1;
const ZOOM_DURATION_MS = 320;
const FIT_DURATION_MS = 420;

type CosmographInstance = CosmographRef<GraphNode, GraphEdge>;

type ZoomTransform = {
  k: number;
  x: number;
  y: number;
  interpolate?: (other: ZoomTransform) => (t: number) => ZoomTransform;
};

type CosmosZoom = {
  getZoomLevel: () => number;
  setZoomLevel: (value: number, duration?: number) => void;
  fitView: (duration?: number, padding?: number) => void;
  getNodePositionsArray: () => ([number, number] | undefined)[];
  zoomInstance: {
    eventTransform?: ZoomTransform;
    getTransform: (
      positions: [number, number][],
      scale?: number,
      padding?: number
    ) => ZoomTransform;
    behavior: { scaleBy: unknown; transform: unknown };
  };
  canvasD3Selection: {
    call: (behavior: unknown, value: unknown) => void;
    node?: () => Node | null;
  };
};

let zoomAnimId = 0;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

const runZoomAnimation = (duration: number, apply: (eased: number) => void) => {
  const id = ++zoomAnimId;
  const startedAt = performance.now();
  const step = (now: number) => {
    if (id !== zoomAnimId) return;
    const t = Math.min(1, (now - startedAt) / duration);
    apply(easeOutCubic(t));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};

const asCosmos = (
  graph: CosmographInstance | null | undefined
): CosmosZoom | null => {
  const cosmos = graph?.cosmos as CosmosZoom | undefined;
  if (!cosmos?.canvasD3Selection || !cosmos.zoomInstance?.behavior) return null;
  const node =
    typeof cosmos.canvasD3Selection.node === "function"
      ? cosmos.canvasD3Selection.node()
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

const applyTransform = (cosmos: CosmosZoom, transform: ZoomTransform) => {
  cosmos.canvasD3Selection.call(
    cosmos.zoomInstance.behavior.transform,
    transform
  );
};

const animateScaleTo = (graph: CosmographInstance, targetK: number) => {
  const cosmos = asCosmos(graph);
  const from = Math.max(
    SMALLEST_ZOOM_LEVEL,
    cosmos?.getZoomLevel() ?? graph.getZoomLevel() ?? 1
  );
  const to = Math.max(SMALLEST_ZOOM_LEVEL, targetK);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === to) return;

  runZoomAnimation(ZOOM_DURATION_MS, (eased) => {
    const next = from + (to - from) * eased;
    if (cosmos) cosmos.setZoomLevel(next, 0);
    else graph.setZoomLevel(next, 0);
  });
};

const animateFit = (graph: CosmographInstance) => {
  const cosmos = asCosmos(graph);
  if (!cosmos) {
    graph.fitView(FIT_DURATION_MS);
    return;
  }

  const positions = finitePositions(cosmos.getNodePositionsArray());
  if (positions.length === 0) {
    graph.fitView(FIT_DURATION_MS);
    return;
  }

  const from = cosmos.zoomInstance.eventTransform ?? {
    k: cosmos.getZoomLevel() || 1,
    x: 0,
    y: 0,
  };
  const to = cosmos.zoomInstance.getTransform(positions, undefined, 0.1);
  const interpolate = from.interpolate?.bind(from);

  if (interpolate) {
    const interp = interpolate(to);
    runZoomAnimation(FIT_DURATION_MS, (eased) => {
      applyTransform(cosmos, interp(eased));
    });
    return;
  }

  runZoomAnimation(FIT_DURATION_MS, (eased) => {
    const current = Object.create(
      Object.getPrototypeOf(to)
    ) as ZoomTransform;
    current.k = from.k + (to.k - from.k) * eased;
    current.x = from.x + (to.x - from.x) * eased;
    current.y = from.y + (to.y - from.y) * eased;
    applyTransform(cosmos, current);
  });
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

    animateFit(graph);
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
    if (!graph) return;
    const current = asCosmos(graph)?.getZoomLevel() ?? graph.getZoomLevel() ?? 1;
    const from =
      typeof current === "number" && Number.isFinite(current) && current > 0
        ? current
        : 1;
    animateScaleTo(graph, from * ZOOM_FACTOR);
  }, [getCosmograph]);

  const zoomOut = useCallback(() => {
    const graph = resolveGraph(getCosmograph);
    if (!graph) return;
    const current = asCosmos(graph)?.getZoomLevel() ?? graph.getZoomLevel() ?? 1;
    const from =
      typeof current === "number" && Number.isFinite(current) && current > 0
        ? current
        : 1;
    animateScaleTo(graph, Math.max(SMALLEST_ZOOM_LEVEL, from / ZOOM_FACTOR));
  }, [getCosmograph]);

  return { fitToScreen, zoomToNode, zoomIn, zoomOut };
};
