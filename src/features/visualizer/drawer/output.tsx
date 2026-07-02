import { useMemo, useState } from "react";
import { Maximize2 } from "lucide-react";
import { DialogDescription, DialogTitle } from "@radix-ui/react-dialog";

import type { BaseGraphAlgorithm } from "../algorithms/implementations";
import { QueryOutput } from "../queries";
import ExportDropdownButton from "../export/export-dropdown-button";
import {
  isAlgorithmVisualizationResult,
  isQueryVisualizationResult,
  type VisualizationResponse,
} from "../types";

import CodeOutputTabs from "./tabs";

import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "~/components/ui/dialog";

export default function OutputTabContent({
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

  const outputContent = useMemo(() => {
    if (!activeResponse) {
      return (
        <div className="flex items-center justify-center h-full text-typography-tertiary small-body">
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

  const dialogTitle = useMemo(() => {
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
  }, [activeAlgorithm, activeResponse]);

  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
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
}
