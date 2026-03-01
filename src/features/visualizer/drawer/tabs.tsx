import { Code, FileText } from "lucide-react";
import type React from "react";

import { TabsList, TabsTrigger } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";

export default function CodeOutputTabs({
  enableOutput = false,
  showCodeTab = true,
  className,
}: {
  enableOutput: boolean;
  /** When false (non-persistent/in-memory graph), hide Code tab since query execution is not supported */
  showCodeTab?: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  // When only Output tab is available, no need to show tab switcher
  if (!showCodeTab) {
    return null;
  }
  return (
    <TabsList className={cn("flex items-center gap-2", className)}>
      {/* Tabs */}
      <TabsTrigger value="code">
        <Code />
        Code
      </TabsTrigger>
      <TabsTrigger value="output" disabled={!enableOutput}>
        <FileText />
        Output
      </TabsTrigger>
    </TabsList>
  );
}
