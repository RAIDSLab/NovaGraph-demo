import type { MouseEvent, ReactNode } from "react";

import { dispatchFocusNode } from "~/features/visualizer/renderer/events";
import { cn } from "~/lib/utils";

type ClickableNodeLabelProps = {
  label: string;
  className?: string;
  title?: string;
  /** `link` for table cells; `chip` for path/community badges; `inline` for prose. */
  variant?: "link" | "chip" | "inline";
  children?: ReactNode;
};

export function ClickableNodeLabel({
  label,
  className,
  title,
  variant = "link",
  children,
}: ClickableNodeLabelProps) {
  const handleClick = (event: MouseEvent) => {
    event.stopPropagation();
    dispatchFocusNode(label);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={title ?? `Jump to ${label} on the graph`}
      className={cn(
        "max-w-full truncate text-left transition-colors border-0 cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-outline",
        variant === "link" &&
          "bg-transparent p-0 text-primary underline-offset-2 hover:underline",
        variant === "chip" &&
          "px-3 py-1.5 rounded-md bg-primary-low hover:bg-primary-low/80",
        variant === "inline" &&
          "inline bg-transparent p-0 font-medium text-primary underline-offset-2 hover:underline",
        className
      )}
    >
      {children ?? label}
    </button>
  );
}
