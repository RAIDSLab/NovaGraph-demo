import { useEffect, useMemo, useState } from "react";
import { GitCompareArrows, Layers, Maximize2 } from "lucide-react";
import { DialogDescription, DialogTitle } from "@radix-ui/react-dialog";
import { observer } from "mobx-react-lite";
import { toast } from "sonner";

import type { BaseGraphAlgorithm } from "../algorithms/implementations";
import { ComparePanel, canCompare } from "../compare";
import { QueryOutput } from "../queries";
import ExportDropdownButton from "../export/export-dropdown-button";
import { useStore } from "../hooks/use-store";
import { buildLabelToIdMap } from "../layer-slice";
import {
  isAlgorithmVisualizationResult,
  isQueryVisualizationResult,
  type VisualizationResponse,
} from "../types";

import CodeOutputTabs from "./tabs";

import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "~/components/ui/dialog";
import { cn } from "~/lib/utils";

type OutputViewMode = "result" | "compare";

const OutputTabContent = observer(function OutputTabContent({
  activeAlgorithm,
  activeResponse,
  enableOutput,
  showCodeTab = true,
}: {
  activeAlgorithm: BaseGraphAlgorithm | null;
  activeResponse: VisualizationResponse | null;
  enableOutput: boolean;
  /** When false (non-persistent graph), hide Code tab switcher */
  showCodeTab?: boolean;
}) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [viewMode, setViewMode] = useState<OutputViewMode>("result");
  const { database, setLayerSlice, clearLayerSlice, databaseDrawerStateMap } =
    useStore();
  const { layerSlice, previousRun } =
    databaseDrawerStateMap[database!.name];

  const canSlice =
    !!activeAlgorithm?.buildSliceSteps &&
    !!activeResponse &&
    isAlgorithmVisualizationResult(activeResponse) &&
    "data" in activeResponse;

  const showCompare =
    !!previousRun &&
    !!activeResponse &&
    isAlgorithmVisualizationResult(activeResponse) &&
    "data" in activeResponse &&
    canCompare(previousRun.response, activeResponse);

  useEffect(() => {
    setViewMode("result");
  }, [activeResponse, previousRun]);

  useEffect(() => {
    if (!showCompare && viewMode === "compare") {
      setViewMode("result");
    }
  }, [showCompare, viewMode]);

  const resultContent = useMemo(() => {
    if (!activeResponse) {
      return (
        <div className="flex h-full items-center justify-center text-typography-tertiary small-body">
          No output to display. Run a query or algorithm to see results.
        </div>
      );
    }
    if (!!activeAlgorithm && isAlgorithmVisualizationResult(activeResponse)) {
      return activeAlgorithm.output(activeResponse);
    }
    if (isQueryVisualizationResult(activeResponse)) {
      return <QueryOutput data={activeResponse.queryData} />;
    }
    return null;
  }, [activeAlgorithm, activeResponse]);

  const outputContent = useMemo(() => {
    if (
      viewMode === "compare" &&
      showCompare &&
      previousRun &&
      activeResponse &&
      isAlgorithmVisualizationResult(activeResponse) &&
      "data" in activeResponse
    ) {
      return (
        <ComparePanel
          previousRun={previousRun}
          currentResponse={activeResponse}
          currentTitle={activeAlgorithm?.title ?? "Current"}
        />
      );
    }
    return resultContent;
  }, [
    viewMode,
    showCompare,
    previousRun,
    activeResponse,
    activeAlgorithm,
    resultContent,
  ]);

  const dialogTitle = useMemo(() => {
    if (viewMode === "compare" && showCompare) {
      return "Compare Results";
    }
    if (!activeResponse) {
      return "Output";
    }
    if (!!activeAlgorithm && isAlgorithmVisualizationResult(activeResponse)) {
      return activeAlgorithm.title + " Result";
    }
    if (isQueryVisualizationResult(activeResponse)) {
      const queryLength =
        activeResponse.queryData.successQueries.length +
        activeResponse.queryData.failedQueries.length;
      return `Query Results (${queryLength} ${
        queryLength === 1 ? "query" : "queries"
      } processed)`;
    }
    return "Output";
  }, [activeResponse, activeAlgorithm, viewMode, showCompare]);

  const onToggleLayerSlice = () => {
    if (!canSlice || !activeAlgorithm?.buildSliceSteps || !activeResponse) {
      return;
    }
    if (layerSlice?.active) {
      clearLayerSlice();
      return;
    }
    if (
      !isAlgorithmVisualizationResult(activeResponse) ||
      !("data" in activeResponse)
    ) {
      return;
    }
    const labelToId = buildLabelToIdMap(database!.graph.nodes);
    const steps = activeAlgorithm.buildSliceSteps(
      (activeResponse as { data: unknown }).data,
      { labelToId }
    );
    if (steps.length === 0) {
      toast.error("No slice steps available for this result");
      return;
    }
    setLayerSlice({
      active: true,
      currentIndex: 0,
      steps,
    });
  };

  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
        {showCompare && (
          <div className="mb-2 flex shrink-0 gap-1">
            <Button
              type="button"
              size="sm"
              variant={viewMode === "result" ? "default" : "ghost"}
              className={cn("h-8")}
              onClick={() => setViewMode("result")}
            >
              Result
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === "compare" ? "default" : "ghost"}
              className={cn("h-8")}
              onClick={() => setViewMode("compare")}
              title={`Compare with previous: ${previousRun?.title}`}
            >
              <GitCompareArrows className="size-3.5" />
              Compare
            </Button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="h-full min-h-0">{outputContent}</div>
        </div>
        <div className="relative z-10 mt-2 shrink-0 border-t border-border bg-gradient-to-br from-neutral-low/20 to-neutral/20 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CodeOutputTabs
              enableOutput={enableOutput}
              showCodeTab={showCodeTab}
            />
            {!!activeResponse && (
              <div className="flex items-center gap-2">
                {canSlice && viewMode === "result" && (
                  <Button
                    variant={layerSlice?.active ? "default" : "ghost"}
                    onClick={onToggleLayerSlice}
                    title="Preview cumulative layers from the result"
                  >
                    <Layers />
                    {layerSlice?.active ? "Exit Slice" : "Layer Slice"}
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setIsFullScreen(true)}>
                  <Maximize2 /> Fullscreen
                </Button>
                <ExportDropdownButton activeResponse={activeResponse} />
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={isFullScreen} onOpenChange={setIsFullScreen}>
        <DialogContent className="flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-semibold">{dialogTitle}</DialogTitle>
            <DialogDescription className="hidden">
              Shows the full results from your latest run
            </DialogDescription>
          </DialogHeader>
          {outputContent}
        </DialogContent>
      </Dialog>
    </>
  );
});

export default OutputTabContent;
