import { useEffect, useRef, useState } from "react";
import { List, type ListProps } from "react-window";

import { cn } from "~/lib/utils";

const DEFAULT_LIST_HEIGHT_PX = 320;
const MIN_LIST_HEIGHT_PX = 128;

export function VirtualizedListPanel<RowProps extends object>(
  props: ListProps<RowProps> & { containerClassName?: string }
) {
  const { containerClassName, className, style, ...listProps } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(DEFAULT_LIST_HEIGHT_PX);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateHeight = () => {
      const nextHeight = element.clientHeight;
      if (nextHeight > 0) {
        setHeight(Math.max(nextHeight, MIN_LIST_HEIGHT_PX));
      }
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "min-h-32 flex-1 overflow-hidden rounded-md border border-border",
        containerClassName
      )}
    >
      <List
        className={className}
        style={{ height, width: "100%", ...style }}
        {...listProps}
      />
    </div>
  );
}
