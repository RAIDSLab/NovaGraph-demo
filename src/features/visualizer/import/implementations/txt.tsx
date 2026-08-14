import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import { useState } from "react";
import { FileText } from "lucide-react";

import type VisualizerStore from "../../store";

import type { ImportOption } from "./types";

import { Switch } from "~/components/form/switch";
import { Label } from "~/components/form/label";
import {
  createFileInput,
  createSwitchInput,
  createTextInput,
} from "~/features/visualizer/inputs";
import {
  emptyBenchmarkTiming,
  logBenchmarkTiming,
} from "~/igraph/benchmark-timing";
import {
  parseEdgeListTxtToEdgesCsv,
  parseNodesTxtToNodesCsv,
} from "~/lib/parseEdgeListTxt";
import { synthesizeNodesFromEdges } from "~/lib/synthesizeNodesFromEdges";

const validateNodesTxt = async (file: File | undefined) => {
  // nodes.txt is optional — nodes can be inferred from edges source/target
  if (!file) return { success: true };

  try {
    const text = await file.text();
    parseNodesTxtToNodesCsv(text);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to parse TXT nodes file",
    };
  }
};

const validateEdgesTxt = async (file: File | undefined) => {
  if (!file) {
    return {
      success: false,
      message: "Unable to read file content. Please try again.",
    };
  }

  try {
    const text = await file.text();
    parseEdgeListTxtToEdgesCsv(text);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to parse TXT edge list",
    };
  }
};

export const ImportTXT: ImportOption = {
  label: "Import as TXT",
  value: "txt",
  icon: FileText,
  title: "Import TXT Files",
  description:
    "Upload edges.txt (required) and optionally nodes.txt. Edge lines may be whitespace-separated (`source target` or `source target weight`) or CSV-style (`source,target`). An optional header row is skipped. Blank lines and `#` comments are ignored. If nodes.txt is omitted, unique source/target values become nodes. For nodes.txt: one ID per line, or a header row plus attribute columns (first column is the primary key).",
  previewTitle: "TXT Format Preview",
  previewDescription:
    "Expected format for edges.txt; nodes.txt is optional and can be inferred",
  preview: TXTPreview,
  note: "nodes.txt is **optional** — if omitted, Novagraph infers nodes from edge endpoints. Comma-separated edge lists (including a `source,target` header) are supported. Optional third edge column is treated as **weight**. Edges in a directed graph have directions; in an undirected graph they are bi-directional.",
  inputs: [
    createTextInput({
      id: "database-name-txt",
      key: "name",
      displayName: "Name of the database",
      required: true,
      placeholder: "Enter a name for the database...",
    }),
    createSwitchInput({
      id: "directed-graph-txt",
      key: "isDirected",
      displayName: "Directed Graph",
      defaultValue: true,
    }),
    createSwitchInput({
      id: "persistent-graph-txt",
      key: "persistent",
      displayName: "Store in Database (Persistent)",
      defaultValue: true,
    }),
    createFileInput({
      id: "nodes-txt",
      key: "nodes",
      displayName: "nodes.txt (optional)",
      required: false,
      accept: ".txt",
      validator: validateNodesTxt,
    }),
    createFileInput({
      id: "edges-txt",
      key: "edges",
      displayName: "edges.txt",
      required: true,
      accept: ".txt",
      validator: validateEdgesTxt,
    }),
  ],
  handler: async ({
    values,
    controller,
  }: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    values: Record<string, any>;
    controller: VisualizerStore["controller"];
  }) => {
    const { name, nodes, edges, isDirected, persistent } = values;

    const databaseName = name.value as string;
    const directed = Boolean(isDirected?.value ?? true);
    const isPersistent = Boolean(persistent?.value ?? true);

    const nodesFile = nodes?.value as File | undefined;
    const edgesFile = edges.value as File;

    const edgesText = parseEdgeListTxtToEdgesCsv(await edgesFile.text());
    const edgeTableName = edgesFile.name.replace(/\.txt$/i, "") || "edges";

    let nodesText: string;
    let nodeTableName: string;
    let nodesFileName: string;

    if (nodesFile) {
      nodesText = parseNodesTxtToNodesCsv(await nodesFile.text());
      nodeTableName = nodesFile.name.replace(/\.txt$/i, "") || "nodes";
      nodesFileName = nodesFile.name;
    } else {
      nodesText = synthesizeNodesFromEdges(edgesText);
      nodeTableName = "nodes";
      nodesFileName = "(inferred from edges)";
    }

    let databaseCreated = false;
    try {
      if (isPersistent) {
        await controller.db.createDatabase(databaseName, {
          isDirected: directed,
          persistent: true,
        });
        databaseCreated = true;
        await controller.db.connectToDatabase(databaseName);
      } else {
        await controller.db.createDatabase(databaseName, {
          isDirected: directed,
          persistent: false,
        });
        databaseCreated = true;
      }

      const startTime = performance.now();
      const result = await controller.db.importFromCSV(
        databaseName,
        nodesText,
        edgesText,
        nodeTableName,
        edgeTableName,
        directed,
        isPersistent
      );
      const t0Ms = performance.now() - startTime;
      console.log(`Time taken for importFromTXT: ${t0Ms}ms`);
      const timing = emptyBenchmarkTiming();
      timing.T0_import_ms = t0Ms;
      timing.primary_prepared_invoke_ms = null;
      logBenchmarkTiming({
        operation: "importFromCSV",
        caseId: "BC00",
        timing,
        input: {
          nodes_file: nodesFileName,
          edges_file: edgesFile.name,
          format: "txt",
          directed,
          persistent: isPersistent,
        },
      });

      if (isPersistent) {
        await controller.db.saveDatabase();
      }

      return {
        ...result,
        persistent: isPersistent,
      };
    } catch (err) {
      if (databaseCreated && isPersistent) {
        await controller.db.deleteDatabase(databaseName);
      }
      throw err;
    }
  },
};

function TXTPreview() {
  const [showNodes, setShowNodes] = useState(true);

  return (
    <div className="flex flex-col items-end gap-6 mt-4 w-full">
      <div className="flex items-center gap-2">
        <Label htmlFor="toggle-nodes-preview-txt">Show nodes.txt</Label>
        <Switch
          id="toggle-nodes-preview-txt"
          checked={showNodes}
          onCheckedChange={setShowNodes}
        />
      </div>
      <div className={`grid gap-4 w-full ${showNodes ? "grid-cols-2" : "grid-cols-1"}`}>
        {showNodes && (
          <div className="flex flex-col items-center w-full">
            <SyntaxHighlighter
              language="text"
              customStyle={{
                width: "100%",
                padding: "1rem",
                background: "transparent",
              }}
            >
              {["# optional node attributes", "id name", "0 Alice", "1 Bob", "2 Carol"].join(
                "\n"
              )}
            </SyntaxHighlighter>
            <p className="text-typography-primary mt-4 small-body">
              nodes.txt (optional)
            </p>
          </div>
        )}
        <div className="flex flex-col items-center w-full">
          <SyntaxHighlighter
            language="text"
            customStyle={{
              width: "100%",
              padding: "1rem",
              background: "transparent",
            }}
          >
            {[
              "# Directed graph: example.txt",
              "# FromNodeId ToNodeId Weight",
              "0 1 1",
              "0 2 1",
              "1 2 2",
            ].join("\n")}
          </SyntaxHighlighter>
          <p className="text-typography-primary mt-4 small-body">edges.txt</p>
        </div>
      </div>
      <p className="text-typography-secondary small-body text-center w-full">
        Whitespace-separated. Comments start with #. nodes.txt may be one ID per
        line, or a header plus attribute columns.
      </p>
    </div>
  );
}
