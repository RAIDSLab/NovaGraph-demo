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
  computePrimaryPreparedInvokeMs,
  emptyBenchmarkTiming,
  logBenchmarkTiming,
} from "~/igraph/benchmark-timing";

const waitForUiPaint = async () => {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
};

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
    startLoading("Running Algorithm...");

    void (async () => {
      const t5Start = performance.now();
      try {
        const args = algorithm.inputs.map((input) => inputResults[input.key].value);
        console.log(`[Algorithm Input] ${algorithm.title}: ${JSON.stringify(args)}`);

        const t4Start = performance.now();
        const algorithmResponse = await algorithm.wasmFunction(
          controller.getAlgorithm(),
          args
        );
        const t4Ms = performance.now() - t4Start;
        console.log(`Time taken for ${algorithm.title}: ${t4Ms}ms`);

        setActiveAlgorithm(algorithm);
        setActiveResponse(algorithmResponse);
        await waitForUiPaint();

        const timing = {
          ...emptyBenchmarkTiming(),
          T4_system_invoke_ms: t4Ms,
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
        const timing = {
          ...emptyBenchmarkTiming(),
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
