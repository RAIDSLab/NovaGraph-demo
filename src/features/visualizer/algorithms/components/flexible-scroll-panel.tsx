import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

export function FlexibleScrollPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-h-32 flex-1 overflow-auto rounded-md border border-border",
        className
      )}
    >
      {children}
    </div>
  );
}
