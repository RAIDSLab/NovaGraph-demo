import { FileCode2 } from "lucide-react";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";

import type VisualizerStore from "../../store";

import type { ImportOption } from "./types";

import {
  createFileInput,
  createSwitchInput,
  createTextInput,
} from "~/features/visualizer/inputs";
import { parseGraphML } from "~/lib/parseGraphML";

const validateGraphML = async (file: File | undefined) => {
  if (!file) {
    return {
      success: false,
      message: "Unable to read file content. Please try again.",
    };
  }

  try {
    const text = await file.text();
    parseGraphML(text);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Unable to parse GraphML file",
    };
  }
};

export const ImportGraphML: ImportOption = {
  label: "Import as GraphML",
  value: "graphml",
  icon: FileCode2,
  title: "Import GraphML File",
  description:
    "Upload a GraphML (.graphml / .xml) file containing nodes and edges. Node ids and edge source/target attributes become the graph topology; <data> key values are imported as properties. The directedness switch overrides edgedefault when set.",
  previewTitle: "GraphML Format Preview",
  previewDescription: "Minimal GraphML with nodes, edges, and attributes",
  preview: GraphMLPreview,
  note: "Requires at least one `<edge>`. Missing node declarations for edge endpoints are inferred automatically. Viz style beyond attributes is not imported.",
  inputs: [
    createTextInput({
      id: "database-name-graphml",
      key: "name",
      displayName: "Name of the database",
      required: true,
      placeholder: "Enter a name for the database...",
    }),
    createSwitchInput({
      id: "directed-graph-graphml",
      key: "isDirected",
      displayName: "Directed Graph",
      defaultValue: true,
    }),
    createSwitchInput({
      id: "persistent-graph-graphml",
      key: "persistent",
      displayName: "Store in Database (Persistent)",
      defaultValue: true,
    }),
    createFileInput({
      id: "graphml-file",
      key: "graphml",
      displayName: "graph.graphml",
      required: true,
      accept: ".graphml,.xml",
      validator: validateGraphML,
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
    const { name, graphml, isDirected, persistent } = values;

    const databaseName = name.value as string;
    const directed = Boolean(isDirected?.value ?? true);
    const isPersistent = Boolean(persistent?.value ?? true);

    const file = graphml.value as File;
    const xmlText = await file.text();
    const stem = file.name.replace(/\.(graphml|xml)$/i, "") || "graph";
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

      const result = await controller.db.importFromGraphML(
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

function GraphMLPreview() {
  const sample = `<?xml version="1.0" encoding="UTF-8"?>
<graphml>
  <key id="d0" for="node" attr.name="label" attr.type="string"/>
  <key id="d1" for="edge" attr.name="weight" attr.type="double"/>
  <graph id="G" edgedefault="directed">
    <node id="n1"><data key="d0">Alice</data></node>
    <node id="n2"><data key="d0">Bob</data></node>
    <edge source="n1" target="n2"><data key="d1">1.5</data></edge>
  </graph>
</graphml>`;

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
