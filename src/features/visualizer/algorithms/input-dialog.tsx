import { cloneElement, useMemo, useState } from "react";
import { toast } from "sonner";

import type { GraphNode } from "../types";
import InputComponent, { createEmptyInputResults } from "../inputs";
import type VisualizerStore from "../store";

import type {
  BaseGraphAlgorithm,
  BaseGraphAlgorithmResult,
} from "./implementations";

import { SidebarMenuButton } from "~/components/ui/sidebar";
import { cn } from "~/lib/utils";
import { Separator } from "~/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { useLoading } from "~/components/ui/loading";
import {
  ALGORITHM_RENDER_DONE_EVENT,
  ALGORITHM_RUN_STATE_EVENT,
  type AlgorithmRenderDoneDetail,
} from "~/features/visualizer/renderer/events";
import {
  computePrimaryPreparedInvokeMs,
  emptyBenchmarkTiming,
  logBenchmarkTiming,
} from "~/igraph/benchmark-timing";

const RENDER_DONE_TIMEOUT_MS = 15_000;

const waitForRenderDone = (runId: string): Promise<void> =>
  new Promise((resolve) => {
    let done = false;

    const cleanup = () => {
      window.removeEventListener(ALGORITHM_RENDER_DONE_EVENT, onRenderDone);
      window.clearTimeout(timeoutId);
    };

    const finish = () => {
      if (done) return;
      done = true;
      cleanup();
      resolve();
    };

    const onRenderDone = (event: Event) => {
      const detail =
        (event as CustomEvent<AlgorithmRenderDoneDetail>).detail ?? null;
      if (detail?.runId === runId) {
        finish();
      }
    };

    const timeoutId = window.setTimeout(finish, RENDER_DONE_TIMEOUT_MS);
    window.addEventListener(ALGORITHM_RENDER_DONE_EVENT, onRenderDone);
  });

export default function InputDialog({
  controller,
  algorithm,
  nodes,
  setActiveAlgorithm,
  setActiveResponse,
  separator = false,
  className,
  ...props
}: React.ComponentProps<"button"> & {
  controller: VisualizerStore["controller"];
  algorithm: BaseGraphAlgorithm;
  nodes: GraphNode[];
  setActiveAlgorithm: (a: BaseGraphAlgorithm | null) => void;
  setActiveResponse: (a: BaseGraphAlgorithmResult | null) => void;
  separator?: boolean;
}) {
  // Hooks
  const { startLoading, stopLoading } = useLoading();

  // States
  const [open, setOpen] = useState(false);
  const [inputResults, setInputResults] = useState(
    createEmptyInputResults(algorithm.inputs)
  );

  // Memoised values
  const isReadyToSubmit = useMemo(
    () => Object.values(inputResults).every((v) => v.success),
    [inputResults, algorithm]
  );

  const handleSubmit = () => {
    if (!controller) return;

    // Don't run when there's no nodes
    if (nodes.length === 0) {
      throw new Error(
        "Cannot run algorithm — no nodes found. Try adding some nodes first"
      );
    }

    setOpen(false);
    setInputResults(createEmptyInputResults(algorithm.inputs));
    startLoading("Running Algorithm");
    const runId = `algo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const renderDonePromise = waitForRenderDone(runId);
    window.dispatchEvent(
      new CustomEvent(ALGORITHM_RUN_STATE_EVENT, {
        detail: { running: true, runId },
      })
    );

    void (async () => {
      const t5Start = performance.now();
      try {
        const igraphController = controller.getAlgorithm();
        const args = algorithm.inputs.map((input) => inputResults[input.key].value);
        console.log(`[Algorithm Input] ${algorithm.title}: ${JSON.stringify(args)}`);

        const algorithmResponse = await igraphController.runMeasured(() =>
          algorithm.wasmFunction(igraphController, args)
        );
        startLoading("Applying Visualization");
        setActiveAlgorithm(algorithm);
        setActiveResponse(algorithmResponse);
        await renderDonePromise;

        const igraphTiming =
          igraphController.getLastBenchmarkTiming() ??
          emptyBenchmarkTiming();
        const timing = {
          ...igraphTiming,
          T5_ui_e2e_ms: performance.now() - t5Start,
        };
        timing.primary_prepared_invoke_ms = computePrimaryPreparedInvokeMs(timing);

        const outputPreview = JSON.stringify(
          "data" in algorithmResponse ? algorithmResponse.data : algorithmResponse
        );
        console.log(
          `[Algorithm Output] ${algorithm.title}: ${outputPreview.slice(0, 2000)}`
        );
        logBenchmarkTiming({
          operation: algorithm.title,
          timing,
          input: args,
          output:
            "data" in algorithmResponse ? algorithmResponse.data : algorithmResponse,
        });
      } catch (err) {
        const igraphController = controller.getAlgorithm();
        const igraphTiming =
          igraphController.getLastBenchmarkTiming() ??
          emptyBenchmarkTiming();
        const timing = {
          ...igraphTiming,
          T5_ui_e2e_ms: performance.now() - t5Start,
        };
        logBenchmarkTiming({
          operation: algorithm.title,
          timing,
          input: algorithm.inputs.map((input) => inputResults[input.key].value),
        });
        toast.error(
          String(err) ?? "An unexpected error occurred. Please try again later."
        );
      } finally {
        stopLoading();
        window.dispatchEvent(
          new CustomEvent(ALGORITHM_RUN_STATE_EVENT, {
            detail: { running: false, runId },
          })
        );
      }
    })();
  };

  const menuButton = (
    <SidebarMenuButton
      className={cn("p-0 hover:[&>span]:bg-neutral-low", className)}
      {...props}
    >
      {separator && <Separator className="ml-4 mr-2" orientation="vertical" />}
      <span className="flex items-center px-3 rounded-md h-full w-full truncate">
        {algorithm.title}
      </span>
    </SidebarMenuButton>
  );

  // Return just the button if we don't need inputs from users
  if (algorithm.inputs.length <= 0) {
    return cloneElement(menuButton, {
      onClick: handleSubmit,
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{menuButton}</DialogTrigger>
      {/* Title + Description */}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{algorithm.title}</DialogTitle>
          <DialogDescription>{algorithm.description}</DialogDescription>
        </DialogHeader>
        {/* Inputs */}
        <div className="space-y-3 mt-2">
          {algorithm.inputs.map((input, index) => (
            <InputComponent
              key={index}
              input={input}
              value={inputResults[input.key]?.value}
              onChange={(value) =>
                setInputResults((prev) => ({
                  ...prev,
                  [input.key]: value,
                }))
              }
            />
          ))}
        </div>
        {/* Submit button */}
        <DialogFooter>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={!isReadyToSubmit}
          >
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
