import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import { useState } from "react";
import { Table as TableIcon } from "lucide-react";

import type VisualizerStore from "../../store";

import type { ImportOption } from "./types";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
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
import { synthesizeNodesFromEdges } from "~/lib/synthesizeNodesFromEdges";
import {
  EDGE_ENDPOINT_ALIAS_HELP,
  normalizeEdgesCsvText,
  resolveEndpointColumns,
} from "~/lib/resolveEdgeEndpoints";

const validateNodes = async (file: File | undefined) => {
  // nodes.csv is optional — nodes can be inferred from edges source/target
  if (!file) return { success: true };

  try {
    const text = await file.text();
    const lines = text.trim().split("\n");

    // Check lines has at least two lines (one header and 1 node)
    if (lines.length < 2) {
      return {
        success: false,
        message:
          "Nodes file must have at least two lines (one header, one node)",
      };
    }

    // Check header - now supports multiple columns
    const header = lines[0].trim();
    const columns = header.split(",").map((col) => col.trim());

    if (columns.length === 0) {
      return {
        success: false,
        message: "Nodes file must have at least one column in the header",
      };
    }

    // Check if every line has the same number of columns as header
    const expectedColumns = columns.length;
    const isValid = lines
      .slice(1)
      .every((line) => line.split(",").length === expectedColumns);

    if (!isValid) {
      return {
        success: false,
        message: `Every line should have exactly ${expectedColumns} column(s) to match the header`,
      };
    }

    return { success: true };
  } catch {
    return {
      success: false,
      message: "Unable to read file content. Please try again.",
    };
  }
};

const validateEdges = async (file: File | undefined) => {
  if (!file)
    return {
      value: file,
      success: false,
      message: "Unable to read file content. Please try again.",
    };

  try {
    const text = await file.text();
    const lines = text.trim().split("\n");

    if (lines.length < 2) {
      return {
        success: false,
        message:
          "Edges file must have at least two lines (one header, one edge)",
      };
    }

    // Check header — accept common endpoint aliases
    const header = lines[0].trim();
    const columns = header.split(",").map((col) => col.trim());
    try {
      resolveEndpointColumns(columns);
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Edges file must have endpoint columns in the header",
      };
    }

    // Check if every line has the same number of columns as header
    const validLength = columns.length;
    const isValid = lines
      .slice(1)
      .every((line) => line.split(",").length === validLength);

    if (!isValid) {
      return {
        success: false,
        message: "Number of values don't match with the header",
      };
    }

    return { success: true };
  } catch {
    return {
      success: false,
      message: "Unable to read file content. Please try again. ",
    };
  }
};

export const ImportCSV: ImportOption = {
  label: "Import as CSV",
  value: "csv",
  icon: TableIcon,
  title: "Import CSV Files",
  description:
    "Upload edges.csv (required) and optionally nodes.csv. If nodes.csv is omitted, unique values from the edge endpoint columns are used to create nodes automatically. When provided, the node table name comes from the filename (without .csv), the first column is the primary key, and all columns are imported as node properties. edges.csv must have endpoint columns (source/target or common aliases), with optional weight and other columns.",
  previewTitle: "CSV Format Preview",
  previewDescription:
    "Expected format for edges.csv; nodes.csv is optional and can be inferred",
  preview: CSVPreview,
  note: `nodes.csv is **optional** — if omitted, Novagraph infers nodes from edge endpoints. ${EDGE_ENDPOINT_ALIAS_HELP} The 'weight' column in edges.csv is also optional; its presence signifies a weighted graph. Extra columns such as \`link_id\` or \`edge_id\` are imported as edge properties and may appear in any position. Edges in a directed graph have directions. Edges in an undirected graph are bi-directional.`,
  inputs: [
    createTextInput({
      id: "database-name-csv",
      key: "name",
      displayName: "Name of the database",
      required: true,
      placeholder: "Enter a name for the database...",
    }),
    createSwitchInput({
      id: "directed-graph-csv",
      key: "isDirected",
      displayName: "Directed Graph",
      defaultValue: true,
    }),
    createSwitchInput({
      id: "persistent-graph-csv",
      key: "persistent",
      displayName: "Store in Database (Persistent)",
      defaultValue: true,
    }),
    createFileInput({
      id: "nodes-csv",
      key: "nodes",
      displayName: "nodes.csv (optional)",
      required: false,
      accept: ".csv",
      validator: validateNodes,
    }),
    createFileInput({
      id: "edges-csv",
      key: "edges",
      displayName: "edges.csv",
      required: true,
      accept: ".csv",
      validator: validateEdges,
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

    const edgesTextRaw = await edgesFile.text();
    const edgesText = normalizeEdgesCsvText(edgesTextRaw);
    const edgeTableName = edgesFile.name.replace(/\.csv$/i, "");

    let nodesText: string;
    let nodeTableName: string;
    let nodesFileName: string;

    if (nodesFile) {
      nodesText = await nodesFile.text();
      nodeTableName = nodesFile.name.replace(/\.csv$/i, "");
      nodesFileName = nodesFile.name;
    } else {
      nodesText = synthesizeNodesFromEdges(edgesText);
      nodeTableName = "nodes";
      nodesFileName = "(inferred from edges)";
    }

    let databaseCreated = false;
    try {
      if (isPersistent) {
        await controller.db.createDatabase(databaseName, { isDirected: directed, persistent: true });
        databaseCreated = true;
        await controller.db.connectToDatabase(databaseName);
      } else {
        await controller.db.createDatabase(databaseName, { isDirected: directed, persistent: false });
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
      console.log(`Time taken for importFromCSV: ${t0Ms}ms`);
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

function CSVPreview() {
  const [isTableView, setIsTableView] = useState(true);

  return (
    <div className="flex flex-col items-end gap-6 mt-4">
      <div className="flex items-center gap-2">
        <Label htmlFor="toggle-table-view">Table View</Label>
        <Switch
          id="toggle-table-view"
          checked={isTableView}
          onCheckedChange={setIsTableView}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 w-full">
        {isTableView ? (
          <>
            {/* Table view */}
            <Table className="max-h-56">
              <TableCaption>nodes.csv (optional / inferred)</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>id</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>John</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Michael</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Sarah</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Tina</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <Table className="max-h-56">
              <TableCaption>edges.csv</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>source</TableHead>
                  <TableHead>target</TableHead>
                  <TableHead>weight</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>John</TableCell>
                  <TableCell>Michael</TableCell>
                  <TableCell>1</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>John</TableCell>
                  <TableCell>Sarah</TableCell>
                  <TableCell>1</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Sarah</TableCell>
                  <TableCell>Tina</TableCell>
                  <TableCell>2</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Sarah</TableCell>
                  <TableCell>Michael</TableCell>
                  <TableCell>2</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </>
        ) : (
          <>
            {/* Syntax highlighted code block */}
            <div className="flex flex-col items-center w-full">
              <SyntaxHighlighter
                language="csv"
                customStyle={{
                  width: "100%",
                  padding: "1rem",
                  background: "transparent",
                }}
              >
                {["id", "John", "Michael", "Sarah", "Tina"].join("\n")}
              </SyntaxHighlighter>
              <p className="text-typography-primary mt-4 small-body">
                nodes.csv (optional / inferred)
              </p>
            </div>
            <div className="flex flex-col items-center w-full">
              <SyntaxHighlighter
                language="csv"
                customStyle={{
                  width: "100%",
                  padding: "1rem",
                  background: "transparent",
                }}
              >
                {[
                  "source,target,weight",
                  "John,Michael,1",
                  "John,Sarah,1",
                  "Sarah,Tina,2",
                  "Sarah,Michael,2",
                ].join("\n")}
              </SyntaxHighlighter>
              <p className="text-typography-primary mt-4 small-body">
                edges.csv
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
