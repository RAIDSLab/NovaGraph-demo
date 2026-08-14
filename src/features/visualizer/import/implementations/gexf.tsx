import { Share2 } from "lucide-react";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";

import type VisualizerStore from "../../store";

import type { ImportOption } from "./types";

import {
  createFileInput,
  createSwitchInput,
  createTextInput,
} from "~/features/visualizer/inputs";
import { parseGEXF } from "~/lib/parseGEXF";

const validateGEXF = async (file: File | undefined) => {
  if (!file) {
    return {
      success: false,
      message: "Unable to read file content. Please try again.",
    };
  }

  try {
    const text = await file.text();
    parseGEXF(text);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Unable to parse GEXF file",
    };
  }
};

export const ImportGEXF: ImportOption = {
  label: "Import as GEXF",
  value: "gexf",
  icon: Share2,
  title: "Import GEXF File",
  description:
    "Upload a GEXF (.gexf / .xml) file containing nodes and edges. Node ids and edge source/target become the topology; attribute values and optional viz:position (x/y) are imported as properties.",
  previewTitle: "GEXF Format Preview",
  previewDescription: "Minimal GEXF with nodes, edges, and attributes",
  preview: GEXFPreview,
  note: "Requires at least one `<edge>`. Missing node declarations for edge endpoints are inferred. Layout coordinates from `viz:position` are stored as node properties `x`/`y`.",
  inputs: [
    createTextInput({
      id: "database-name-gexf",
      key: "name",
      displayName: "Name of the database",
      required: true,
      placeholder: "Enter a name for the database...",
    }),
    createSwitchInput({
      id: "directed-graph-gexf",
      key: "isDirected",
      displayName: "Directed Graph",
      defaultValue: true,
    }),
    createSwitchInput({
      id: "persistent-graph-gexf",
      key: "persistent",
      displayName: "Store in Database (Persistent)",
      defaultValue: true,
    }),
    createFileInput({
      id: "gexf-file",
      key: "gexf",
      displayName: "graph.gexf",
      required: true,
      accept: ".gexf,.xml",
      validator: validateGEXF,
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
    const { name, gexf, isDirected, persistent } = values;

    const databaseName = name.value as string;
    const directed = Boolean(isDirected?.value ?? true);
    const isPersistent = Boolean(persistent?.value ?? true);

    const file = gexf.value as File;
    const xmlText = await file.text();
    const stem = file.name.replace(/\.(gexf|xml)$/i, "") || "graph";
    const nodeTableName = `${stem}_nodes`;
    const edgeTableName = `${stem}_edges`;

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

      const result = await controller.db.importFromGEXF(
        databaseName,
        xmlText,
        nodeTableName,
        edgeTableName,
        directed,
        isPersistent
      );

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

function GEXFPreview() {
  const sample = `<?xml version="1.0" encoding="UTF-8"?>
<gexf>
  <graph defaultedgetype="directed">
    <attributes class="node">
      <attribute id="0" title="label" type="string"/>
    </attributes>
    <nodes>
      <node id="n1" label="Alice">
        <attvalues><attvalue for="0" value="Alice"/></attvalues>
      </node>
      <node id="n2" label="Bob"/>
    </nodes>
    <edges>
      <edge source="n1" target="n2" weight="1.5"/>
    </edges>
  </graph>
</gexf>`;

  return (
    <div className="mt-4 w-full">
      <SyntaxHighlighter
        language="xml"
        customStyle={{
          width: "100%",
          padding: "1rem",
          background: "transparent",
          fontSize: "0.75rem",
        }}
      >
        {sample}
      </SyntaxHighlighter>
    </div>
  );
}
