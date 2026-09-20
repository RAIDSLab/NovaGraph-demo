import { useCosmograph, type CosmographRef } from "@cosmograph/react";
import {
  useCallback,
  type Dispatch,
  type PointerEvent,
  type SetStateAction,
} from "react";
import {
  Pause,
  Play,
  RotateCcw,
  Shrink,
  Tag,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import type { GraphEdge, GraphNode } from "../types";

import { useZoomControls } from "./hooks/use-zoom-controls";

import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";

const activate = (event: PointerEvent<HTMLButtonElement>, action: () => void) => {
  if (event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  action();
};

export default function GraphRendererFooter({
  getCosmograph,
  isSimulationPaused,
  setIsSimulationPaused,
  showDynamicLabels,
  setShowDynamicLabels,
}: {
  getCosmograph: () => CosmographRef<GraphNode, GraphEdge> | null | undefined;
  isSimulationPaused: boolean;
  setIsSimulationPaused: Dispatch<SetStateAction<boolean>>;
  showDynamicLabels: boolean;
  setShowDynamicLabels: Dispatch<SetStateAction<boolean>>;
}) {
  const { cosmograph } = useCosmograph<GraphNode, GraphEdge>() ?? {};
  const resolveGraph = useCallback(
    () => cosmograph ?? getCosmograph(),
    [cosmograph, getCosmograph]
  );
  const { fitToScreen, zoomIn, zoomOut } = useZoomControls(resolveGraph);

  return (
    <div
      data-zoom-bar="v2"
      className="pointer-events-none z-30 flex justify-between p-4 w-full absolute bottom-0 left-0"
    >
      {/* Left Side */}
      <div className="pointer-events-auto">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onPointerDown={(event) =>
                activate(event, () =>
                  setIsSimulationPaused((prev) => !prev)
                )
              }
              title="Play/Pause Simulation"
            >
              {isSimulationPaused ? <Play /> : <Pause />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Play/Pause Simulation</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onPointerDown={(event) =>
                activate(event, () => getCosmograph()?.create())
              }
              title="Restart Simulation"
            >
              <RotateCcw />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Restart Simulation</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onPointerDown={(event) => activate(event, fitToScreen)}
              title="Fit All Nodes To Screen"
            >
              <Shrink />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Fit All Nodes To Screen</TooltipContent>
        </Tooltip>
      </div>
      {/* Right Side */}
      <div className="pointer-events-auto">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onPointerDown={(event) => activate(event, zoomOut)}
              title="Zoom Out"
            >
              <ZoomOut />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom Out</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onPointerDown={(event) => activate(event, zoomIn)}
              title="Zoom In"
            >
              <ZoomIn />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom In</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onPointerDown={(event) =>
                activate(event, () => setShowDynamicLabels((prev) => !prev))
              }
              title="Show/Hide Node Labels"
            >
              <Tag
                className={
                  showDynamicLabels
                    ? "stroke-page fill-typography-primary"
                    : "stroke-typography-primary fill-page"
                }
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Show/Hide Node Labels</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
