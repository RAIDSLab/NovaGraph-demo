import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { observer } from "mobx-react-lite";
import { toast } from "sonner";

import { useStore } from "../hooks/use-store";
import type { ExecuteQueryResult } from "../types";
import { convertQueryToVisualizationResult } from "../queries";

import CodeTabContent from "./code";
import OutputTabContent from "./output";

import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent } from "~/components/ui/tabs";

const DEFAULT_DRAWER_HEIGHT_PX = 500;
const MIN_DRAWER_HEIGHT_PX = 250;
const MIN_GRAPH_HEIGHT_PX = 250;

const CodeOutputDrawer = observer(({ className }: { className?: string }) => {
  const {
    database,
    setCode,
    setGraphState,
    setActiveResponse,
    databaseDrawerStateMap,
    controller,
  } = useStore();
  const { code, activeAlgorithm, activeResponse } =
    databaseDrawerStateMap[database!.name];

  // States
  const [tabValue, setTabValue] = useState("code");
  const [isExpanded, setIsExpanded] = useState(false);
  const [drawerHeight, setDrawerHeight] = useState(DEFAULT_DRAWER_HEIGHT_PX);
  const [isResizing, setIsResizing] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  const showCodeTab = database!.persistent;

  const clampDrawerHeight = useCallback((height: number) => {
    const container = drawerRef.current?.parentElement;
    const maxHeight = container
      ? container.getBoundingClientRect().height - MIN_GRAPH_HEIGHT_PX
      : DEFAULT_DRAWER_HEIGHT_PX * 2;
    return Math.min(
      Math.max(height, MIN_DRAWER_HEIGHT_PX),
      Math.max(maxHeight, MIN_DRAWER_HEIGHT_PX)
    );
  }, []);

  const handleResizeStart = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (event: MouseEvent) => {
      const container = drawerRef.current?.parentElement;
      if (!container) return;
      const containerBottom = container.getBoundingClientRect().bottom;
      setDrawerHeight(clampDrawerHeight(containerBottom - event.clientY));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, clampDrawerHeight]);

  // Default to open when response internal value is changed
  useEffect(() => {
    if (!!activeResponse) {
      setIsExpanded(true);
      setDrawerHeight((height) =>
        Math.max(height, DEFAULT_DRAWER_HEIGHT_PX)
      );
      setTabValue("output");
    } else {
      setTabValue(showCodeTab ? "code" : "output");
    }
  }, [activeResponse, activeAlgorithm, showCodeTab]);

  const onQuery = (result: ExecuteQueryResult) => {
    const visualizationResult = convertQueryToVisualizationResult(result);
    setActiveResponse(visualizationResult);
  };

  const onSuccessQuery = (result: ExecuteQueryResult) => {
    setGraphState({
      nodes: result.nodes,
      edges: result.edges,
      nodeTables: result.nodeTables,
      edgeTables: result.edgeTables,
      // Preserve current directed flag (result.directed is added in MainController)
      directed: (result as any).directed ?? database.graph.directed,
    });
    onQuery(result);
    toast.success("Query executed successfully!");
  };

  const onErrorQuery = (result: ExecuteQueryResult) => {
    setGraphState({
      nodes: result.nodes,
      edges: result.edges,
      nodeTables: result.nodeTables,
      edgeTables: result.edgeTables,
      directed: (result as any).directed ?? database.graph.directed,
    });
    onQuery(result);
    toast.error("Some queries failed", {
      action: {
        label: "See problems",
        onClick: () => setTabValue("problems"),
      },
    });
  };

  return (
    <div
      ref={drawerRef}
      style={
        {
          "--drawer-height": `${drawerHeight}px`,
        } as React.CSSProperties
      }
      className={cn(
        "bg-gradient-to-br from-neutral-low/20 to-neutral/20",
        className
      )}
    >
      <div
        className={cn(
          "relative",
          !isResizing && "transition-all duration-250 ease-in-out",
          isExpanded ? "h-[var(--drawer-height)]" : "h-12"
        )}
      >
        {isExpanded && (
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize code output panel"
            className={cn(
              "absolute -top-1 left-0 right-0 z-10 flex h-2 items-center justify-center",
              "cursor-ns-resize touch-none",
              "hover:bg-neutral-low/60 active:bg-neutral-low"
            )}
            onMouseDown={handleResizeStart}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="h-1 w-10 rounded-full bg-border" />
          </div>
        )}

        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-neutral-low border-t border-b border-border"
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          <span className="text-sm text-typography-primary font-medium">
            {showCodeTab ? "Show Code/Output" : "Show Output"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-typography-primary hover:text-typography-secondary"
            title="Open Code/Output Panel"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Content */}
        {isExpanded && (
          <Tabs
            value={showCodeTab ? tabValue : "output"}
            onValueChange={setTabValue}
            defaultValue={showCodeTab ? "code" : "output"}
            className="flex h-[calc(var(--drawer-height)-48px)] min-h-0 overflow-hidden px-14 py-4"
          >
            {/* Content for Code - only shown when persistent (store in database) */}
            {showCodeTab && (
              <TabsContent value="code" className="flex min-h-0 flex-col overflow-hidden">
                <CodeTabContent
                  code={code}
                  setCode={setCode}
                  // Use CLI wrapper to support UNDIRECTED DSL on undirected graphs
                  runQuery={controller.db.executeCliQuery.bind(controller.db)}
                  onSuccessQuery={onSuccessQuery}
                  onErrorQuery={onErrorQuery}
                  enableOutput={!!activeResponse}
                />
              </TabsContent>
            )}
            {/* Content for Output */}
              <TabsContent value="output" className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <OutputTabContent
                activeAlgorithm={activeAlgorithm}
                activeResponse={activeResponse}
                enableOutput={!!activeResponse}
                showCodeTab={showCodeTab}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
});

export default CodeOutputDrawer;
