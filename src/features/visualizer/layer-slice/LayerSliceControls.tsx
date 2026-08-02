import { Layers, X } from "lucide-react";
import { observer } from "mobx-react-lite";

import { useStore } from "../hooks/use-store";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

const LayerSliceControls = observer(({ className }: { className?: string }) => {
  const { database, databaseDrawerStateMap, setLayerSliceIndex, clearLayerSlice } =
    useStore();
  const layerSlice = databaseDrawerStateMap[database!.name].layerSlice;

  if (!layerSlice?.active || layerSlice.steps.length === 0) {
    return null;
  }

  const maxIndex = layerSlice.steps.length - 1;
  const current = layerSlice.currentIndex;
  const stepLabel =
    layerSlice.steps[current]?.label ?? `Step ${current}`;

  return (
    <div
      className={cn(
        "pointer-events-auto flex max-w-md items-center gap-3 rounded-md border border-border bg-page/95 px-3 py-2 shadow-sm backdrop-blur-sm",
        className
      )}
    >
      <Layers className="h-4 w-4 shrink-0 text-typography-secondary" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2 text-xs text-typography-secondary">
          <span className="truncate font-medium text-typography-primary">
            Layer Slice
          </span>
          <span className="shrink-0 tabular-nums">
            {current} / {maxIndex}
            {stepLabel ? ` · ${stepLabel}` : null}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={maxIndex}
          step={1}
          value={current}
          aria-label="Layer slice progress"
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-neutral-low accent-primary"
          onChange={(event) =>
            setLayerSliceIndex(Number(event.target.value))
          }
        />
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 shrink-0 px-2 text-xs"
        onClick={() => clearLayerSlice()}
        title="Exit layer slice"
      >
        <X className="h-3.5 w-3.5" />
        Exit
      </Button>
    </div>
  );
});

export default LayerSliceControls;
