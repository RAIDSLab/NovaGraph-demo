import {
  Cosmograph,
  CosmographProvider,
  type CosmographRef,
} from "@cosmograph/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react-lite";

import type { GraphEdge, GraphNode } from "../types";
import { useStore } from "../hooks/use-store";
import {
  buildLabelToIdMap,
  deriveSliceColorMap,
  resolveLabel,
} from "../layer-slice";
import LayerSliceControls from "../layer-slice/LayerSliceControls";
import { useCompareComputation } from "../compare/use-compare-computation";

import GraphRendererHeader from "./header";
import GraphRendererFooter from "./footer";
import { useGraphRendererHelpers } from "./hooks/use-graph-renderer-helpers";
import { useZoomControls } from "./hooks/use-zoom-controls";
import NodeMetadata from "./node-metadata";
import {
  ALGORITHM_RENDER_DONE_EVENT,
  ALGORITHM_RUN_STATE_EVENT,
  FOCUS_NODE_EVENT,
  type AlgorithmRenderDoneDetail,
  type AlgorithmRunStateDetail,
  type FocusNodeDetail,
} from "./events";
import { RENDER_DEFAULTS, SIMULATION_DEFAULTS } from "./constant";

import { cn } from "~/lib/utils";
import { MODE, type ColorMap, type SizeMap } from "~/igraph/types";

const GraphRenderer = observer(({ className }: { className?: string }) => {
  const {
    database,
    gravity,
    nodeSizeScale,
    databaseDrawerStateMap,
    largeGraphEdgeThreshold,
    defaultShowDynamicLabels,
    linkVisibilityDistanceNear,
    linkVisibilityDistanceFar,
    simulationDecay,
    autoPauseOnSimulationEnd,
  } = useStore();
  const {
    activeResponse,
    activeAlgorithm,
    layerSlice,
    runHistory,
    baselineIndex,
    diffHighlight,
  } = databaseDrawerStateMap[database!.name];

  const { nodes, edges, nodesMap, nodeTables, directed } = database.graph;

  const baseline = diffHighlight ? runHistory[baselineIndex] : undefined;
  const compareComputation = useCompareComputation({
    previousResponse: baseline?.response,
    previousAlgorithm: baseline?.algorithm,
    currentResponse: diffHighlight ? activeResponse : null,
    currentAlgorithm: activeAlgorithm,
    nodes,
  });
  const diffCategories = compareComputation?.diff.categories ?? null;

  const { sizes, colors, mode } = useMemo(() => {
    const result: { sizes: SizeMap; colors: ColorMap; mode: number } = {
      sizes: {},
      colors: {},
      mode: MODE.COLOR_SHADE_DEFAULT,
    };
    if (layerSlice?.active && layerSlice.steps.length > 0) {
      const derived = deriveSliceColorMap(
        layerSlice.steps,
        layerSlice.currentIndex
      );
      result.colors = derived.colorMap;
      result.mode = derived.mode;
      return result;
    }
    if (!!activeResponse) {
      !!activeResponse.sizeMap && (result.sizes = activeResponse.sizeMap);
      result.colors = activeResponse.colorMap;
      result.mode = activeResponse.mode;
    }
    return result;
  }, [activeResponse, layerSlice]);

  // Refs
  const cosmographRef = useRef<CosmographRef<GraphNode, GraphEdge> | null>(
    null
  );

  const isLargeGraph = edges.length > largeGraphEdgeThreshold;

  // States
  const [isSimulationPaused, setIsSimulationPaused] = useState(true);
  const [showDynamicLabels, setShowDynamicLabels] = useState(
    defaultShowDynamicLabels && !isLargeGraph
  );
  const [clickedNode, setClickedNode] = useState<GraphNode | null>(null);
  const forcedPauseByAlgorithmRef = useRef(false);
  const pausedBeforeAlgorithmRef = useRef<boolean | null>(null);
  const activeRunIdRef = useRef<string | null>(null);

  // Hooks
  const { nodeSize, nodeColor, linkColor, linkWidth } = useGraphRendererHelpers(
    {
      nodes,
      edges,
      mode,
      colors,
      sizes,
      directed: database.graph.directed,
      diffCategories,
    }
  );
  const { zoomToNode } = useZoomControls(cosmographRef);

  // Auto-start the simulation on data changes for small graphs; large graphs
  // start paused so the initial paint stays cheap. The user can still toggle
  // Play from the footer.
  useEffect(() => {
    setIsSimulationPaused(isLargeGraph);
    setShowDynamicLabels(defaultShowDynamicLabels && !isLargeGraph);
  }, [nodes, edges, isLargeGraph, defaultShowDynamicLabels]);

  // Start/pause simulation based on isSimulationPaused state
  useEffect(() => {
    if (isSimulationPaused) {
      cosmographRef.current?.pause();
    } else {
      cosmographRef.current?.start();
    }
  }, [isSimulationPaused]);

  // Auto-pause when the simulation has cooled down, unless the algorithm run
  // handshake has currently forced the pause state (managed elsewhere).
  const handleSimulationEnd = useCallback(() => {
    if (forcedPauseByAlgorithmRef.current) return;
    if (!autoPauseOnSimulationEnd) return;
    setIsSimulationPaused(true);
  }, [autoPauseOnSimulationEnd]);

  const pixelRatio = useMemo(() => {
    if (typeof window === "undefined") return RENDER_DEFAULTS.PIXEL_RATIO_CAP;
    return Math.min(
      window.devicePixelRatio || 1,
      RENDER_DEFAULTS.PIXEL_RATIO_CAP
    );
  }, []);

  useEffect(() => {
    const handleAlgorithmState = (event: Event) => {
      const detail =
        (event as CustomEvent<AlgorithmRunStateDetail>).detail ?? null;
      if (!detail) return;

      if (detail.running) {
        activeRunIdRef.current = detail.runId ?? null;
        if (!forcedPauseByAlgorithmRef.current) {
          pausedBeforeAlgorithmRef.current = isSimulationPaused;
          forcedPauseByAlgorithmRef.current = true;
        }
        setIsSimulationPaused(true);
        return;
      }

      if (forcedPauseByAlgorithmRef.current) {
        const shouldStayPaused = pausedBeforeAlgorithmRef.current ?? false;
        setIsSimulationPaused(shouldStayPaused);
        pausedBeforeAlgorithmRef.current = null;
        forcedPauseByAlgorithmRef.current = false;
      }
      activeRunIdRef.current = null;
    };

    window.addEventListener(ALGORITHM_RUN_STATE_EVENT, handleAlgorithmState);
    return () =>
      window.removeEventListener(
        ALGORITHM_RUN_STATE_EVENT,
        handleAlgorithmState
      );
  }, [isSimulationPaused]);

  useEffect(() => {
    const pendingRunId = activeRunIdRef.current;
    if (!pendingRunId || !activeResponse) return;

    // Wait for two frames so the algorithm result has reached the canvas.
    let raf2: number | null = null;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        window.dispatchEvent(
          new CustomEvent<AlgorithmRenderDoneDetail>(
            ALGORITHM_RENDER_DONE_EVENT,
            {
              detail: { runId: pendingRunId },
            }
          )
        );
      });
    });

    return () => {
      window.cancelAnimationFrame(raf1);
      if (raf2 !== null) {
        window.cancelAnimationFrame(raf2);
      }
    };
  }, [activeResponse, nodes, edges]);

  // Compute outgoing edges only for the selected node to avoid full O(E)
  // adjacency rebuilding on every render/data change.
  const clickedNodeOutgoingEdges = useMemo(() => {
    if (!clickedNode) return [] as [GraphNode, GraphEdge][];
    const selectedNodeId = clickedNode.id;
    const outgoingEdges: [GraphNode, GraphEdge][] = [];

    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];

      if (edge.source === selectedNodeId) {
        const target = nodesMap.get(edge.target);
        if (target) outgoingEdges.push([target, edge]);
      }

      if (!directed && edge.target === selectedNodeId) {
        const source = nodesMap.get(edge.source);
        if (source) outgoingEdges.push([source, edge]);
      }
    }

    return outgoingEdges;
  }, [clickedNode, nodesMap, edges, directed]);

  // Ego network for canvas labels: clicked node + all 1-hop neighbors
  // (incoming and outgoing), independent of the sidebar's outgoing-only list.
  const clickedNodeNeighborhood = useMemo(() => {
    if (!clickedNode) return [] as GraphNode[];

    const selectedNodeId = clickedNode.id;
    const neighborIds = new Set<string>();

    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      if (edge.source === selectedNodeId) neighborIds.add(edge.target);
      if (edge.target === selectedNodeId) neighborIds.add(edge.source);
    }

    const neighborhood: GraphNode[] = [clickedNode];
    for (const id of neighborIds) {
      const neighbor = nodesMap.get(id);
      if (neighbor) neighborhood.push(neighbor);
    }

    return neighborhood;
  }, [clickedNode, nodesMap, edges]);

  // Change clicked node value when nodes change
  useEffect(() => {
    if (!clickedNode) return;
    const updatedNode = nodesMap.get(clickedNode.id);
    if (updatedNode) {
      setClickedNode(updatedNode);
    } else {
      setClickedNode(null);
    }
  }, [nodes]);

  const clickedNodeSchema = useMemo(() => {
    if (clickedNode) {
      return (
        nodeTables.find((n) => n.tableName === clickedNode.tableName) ?? null
      );
    }
    return null;
  }, [clickedNode, nodeTables]);

  const selectNode = (node: GraphNode | null | undefined) => {
    zoomToNode(node);
    setClickedNode(node ?? null);
  };

  const selectNodeRef = useRef(selectNode);
  selectNodeRef.current = selectNode;

  // Jump to a node from algorithm output (clickable labels).
  useEffect(() => {
    const handleFocusNode = (event: Event) => {
      const detail = (event as CustomEvent<FocusNodeDetail>).detail;
      if (!detail?.label) return;

      const labelToId = buildLabelToIdMap(nodes);
      const id = resolveLabel(detail.label, labelToId);
      if (!id) return;

      const node = nodesMap.get(id);
      if (node) selectNodeRef.current(node);
    };

    window.addEventListener(FOCUS_NODE_EVENT, handleFocusNode);
    return () => window.removeEventListener(FOCUS_NODE_EVENT, handleFocusNode);
  }, [nodes, nodesMap]);

  const unselectNode = (_: GraphNode | null | undefined) => {
    cosmographRef.current?.unselectNodes();
    setClickedNode(null);
  };

  return (
    <CosmographProvider key={database.name} nodes={nodes} links={edges}>
      <div className={cn("flex flex-col w-full h-full relative", className)}>
        {/* Main Graph Visualizer */}
        <Cosmograph
          ref={cosmographRef}
          onClick={selectNode}
          initialZoomLevel={RENDER_DEFAULTS.INITIAL_ZOOM_LEVEL}
          pixelRatio={pixelRatio}
          nodeSize={nodeSize}
          nodeColor={nodeColor}
          nodeGreyoutOpacity={RENDER_DEFAULTS.NODE_GREYOUT_OPACITY}
          nodeLabelAccessor={(node) => String(node._primaryKeyValue)}
          nodeSizeScale={nodeSizeScale}
          linkColor={linkColor}
          linkWidth={linkWidth}
          linkArrows={directed}
          linkGreyoutOpacity={RENDER_DEFAULTS.LINK_GREYOUT_OPACITY}
          linkVisibilityDistanceRange={[
            linkVisibilityDistanceNear,
            linkVisibilityDistanceFar,
          ]}
          linkVisibilityMinTransparency={
            RENDER_DEFAULTS.LINK_VISIBILITY_MIN_TRANSPARENCY
          }
          simulationLinkDistance={SIMULATION_DEFAULTS.LINK_DISTANCE}
          simulationLinkSpring={SIMULATION_DEFAULTS.LINK_SPRING}
          simulationDecay={simulationDecay}
          simulationRepulsion={SIMULATION_DEFAULTS.REPULSION}
          simulationGravity={gravity}
          disableSimulation={false}
          onSimulationEnd={handleSimulationEnd}
          showDynamicLabels={showDynamicLabels}
          showLabelsFor={clickedNode ? clickedNodeNeighborhood : undefined}
          showHoveredNodeLabel={true}
          hoveredNodeRingColor="#5f5ffa"
          renderHoveredNodeRing={true}
          backgroundColor="transparent"
          hoveredNodeLabelColor="white"
          nodeLabelColor="white"
          className="bg-page flex-1"
        />

        {/* Node Attributes Form */}
        {!!clickedNode && !!clickedNodeSchema && (
          <NodeMetadata
            key={clickedNode.id}
            node={clickedNode}
            nodeSchema={clickedNodeSchema}
            outgoingEdges={clickedNodeOutgoingEdges}
            directed={directed}
            onClose={() => unselectNode(clickedNode)}
          />
        )}

        {/* Top Gradient Overlay */}
        <GradientOverlay position="top" />

        {/* Visualizer Header */}
        <GraphRendererHeader onSelectNode={selectNode} />

        {/* Bottom Gradient Overlay */}
        <GradientOverlay position="bottom" />

        {/* Layer Slice slider (post-run overlay) */}
        <div className="pointer-events-none absolute bottom-14 left-1/2 z-10 -translate-x-1/2 px-4">
          <LayerSliceControls />
        </div>

        {/* Footer */}
        <GraphRendererFooter
          cosmographRef={cosmographRef}
          isSimulationPaused={isSimulationPaused}
          setIsSimulationPaused={setIsSimulationPaused}
          showDynamicLabels={showDynamicLabels}
          setShowDynamicLabels={setShowDynamicLabels}
        />
      </div>
    </CosmographProvider>
  );
});

function GradientOverlay({ position }: { position: "top" | "bottom" }) {
  return (
    <div
      tabIndex={-1}
      className={cn(
        "w-full h-16 absolute left-0 pointer-events-none",
        position === "top"
          ? "bg-gradient-to-t from-transparent to-page to-50% top-0"
          : "bg-gradient-to-b from-transparent to-page to-50% bottom-0"
      )}
    />
  );
}

export default GraphRenderer;
