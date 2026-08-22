import { useMemo } from "react";
import { observer } from "mobx-react-lite";

import CodeEditor from "../../../components/ui/code-editor";
import type { ExecuteQueryResult } from "../types";
import { useStore } from "../hooks/use-store";

import CodeOutputTabs from "./tabs";

import { Button } from "~/components/ui/button";
import CopyButton from "~/components/ui/code-editor/copy-button";

export default observer(function CodeTabContent({
  code,
  setCode,
  runQuery,
  onSuccessQuery,
  onErrorQuery,
  enableOutput,
}: {
  code: string;
  setCode: (s: string) => void;
  runQuery: (query: string) => Promise<ExecuteQueryResult>;
  onSuccessQuery: (r: ExecuteQueryResult) => void;
  onErrorQuery: (r: ExecuteQueryResult) => void;
  enableOutput: boolean;
}) {
  const { database } = useStore();
  const { nodeTables, edgeTables, nodes, edges } = database.graph;
  const graph = useMemo(
    () => ({ nodeTables, edgeTables, nodes, edges }),
    [nodeTables, edgeTables, nodes, edges]
  );

  // Memoised value
  const isReadyToSubmit = useMemo(() => !!code, [code]);

  // Handle query result (error and success state and colorMap)
  const handleRunQuery = async () => {
    const result = await runQuery(code);
    if (!result.success) {
      onErrorQuery(result);
      return;
    }
    onSuccessQuery(result);
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <CodeEditor
        code={code}
        setCode={setCode}
        graph={graph}
        className="flex-1 basis-0 min-h-0"
      />
      <div className="flex flex-wrap-reverse justify-between gap-2">
        <CodeOutputTabs enableOutput={enableOutput} />
        <div className="flex items-center gap-2">
          <CopyButton variant="ghost" value={code} />
          <Button
            type="submit"
            onClick={handleRunQuery}
            disabled={!isReadyToSubmit}
            className="flex-1"
          >
            Run Query
          </Button>
        </div>
      </div>
    </div>
  );
});
