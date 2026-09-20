import type { CosmographRef } from "@cosmograph/react";
import type { Dispatch, SetStateAction } from "react";
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
  const { fitToScreen, zoomIn, zoomOut } = useZoomControls(getCosmograph);

  return (
    <div
      data-guide="canvas"
      className="pointer-events-none z-20 flex justify-between p-4 w-full absolute bottom-0 left-0"
    >
      {/* Left Side */}
      <div className="pointer-events-auto">
        {/* Play/Pause Simulation */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSimulationPaused((prev) => !prev)}
              title="Play/Pause Simulation"
            >
              {isSimulationPaused ? <Play /> : <Pause />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Play/Pause Simulation</TooltipContent>
        </Tooltip>
        {/* Restart Simulation */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => getCosmograph()?.create()}
              title="Restart Simulation"
            >
              <RotateCcw />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Restart Simulation</TooltipContent>
        </Tooltip>
        {/* Fit All Nodes */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fitToScreen()}
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
        {/* Zoom Out */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => zoomOut()}
              title="Zoom Out"
            >
              <ZoomOut />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom Out</TooltipContent>
        </Tooltip>
        {/* Zoom In */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => zoomIn()}
              title="Zoom In"
            >
              <ZoomIn />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom In</TooltipContent>
        </Tooltip>
        {/* Dynamic Labels Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowDynamicLabels((prev) => !prev)}
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
