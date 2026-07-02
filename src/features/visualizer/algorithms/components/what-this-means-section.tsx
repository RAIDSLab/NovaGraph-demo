import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { cn } from "~/lib/utils";

export function WhatThisMeansSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Collapsible
      defaultOpen={false}
      className={cn("group shrink-0 border-t border-t-border pt-2", className)}
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between py-1 text-sm font-semibold hover:text-typography-secondary">
        What this means
        <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="max-h-24 overflow-y-auto pt-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
