import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import CreateNodeSchemaDialog from "./create-node-schema-dialog";
import CreateNodeDialog from "./create-node-dialog";

import { Button } from "~/components/ui/button";
import { useVisualizerUi } from "~/features/visualizer/user-guide/ui-context";
import type { GraphNode, NodeSchema } from "~/features/visualizer/types";
import { isNonEmpty } from "~/lib/utils";

export default function CreateNode({
  nodes,
  nodeTables,
  nodeTablesMap,
}: {
  nodes: GraphNode[];
  nodeTables: NodeSchema[];
  nodeTablesMap: Map<string, NodeSchema>;
}) {
  const { createNodeRequestId } = useVisualizerUi();
  const handledRequestId = useRef(0);
  const [dialogStatus, setDialogStatus] = useState({
    createNode: false,
    createNodeSchema: false,
  });

  const onCloseCreateNode = () => {
    setDialogStatus({ createNode: false, createNodeSchema: false });
  };

  const onCreateSchemaClickCreateNode = () => {
    setDialogStatus((prev) => ({
      createNode: !prev.createNode,
      createNodeSchema: true,
    }));
  };

  const onSubmitCreateNodeSchema = () => {
    if (dialogStatus.createNodeSchema) {
      setDialogStatus({ createNode: true, createNodeSchema: false });
    }
  };

  const setCreateNodeSchemaOpen = (open: boolean) => {
    if (!isNonEmpty(nodeTables)) {
      setDialogStatus({ createNode: false, createNodeSchema: open });
    } else {
      setDialogStatus({ createNode: !open, createNodeSchema: open });
    }
  };

  const openDialog = () => {
    if (!isNonEmpty(nodeTables)) {
      setDialogStatus({ createNode: false, createNodeSchema: true });
    } else {
      setDialogStatus({ createNode: true, createNodeSchema: false });
    }
  };

  useEffect(() => {
    if (createNodeRequestId === 0) return;
    if (createNodeRequestId === handledRequestId.current) return;
    handledRequestId.current = createNodeRequestId;
    if (!isNonEmpty(nodeTables)) {
      setDialogStatus({ createNode: false, createNodeSchema: true });
    } else {
      setDialogStatus({ createNode: true, createNodeSchema: false });
    }
  }, [createNodeRequestId, nodeTables]);

  return (
    <>
      <Button
        title="Create Node"
        variant="outline"
        data-guide="create-node"
        onClick={openDialog}
      >
        <Plus /> Node
      </Button>
      <CreateNodeSchemaDialog
        open={dialogStatus.createNodeSchema}
        setOpen={setCreateNodeSchemaOpen}
        nodeTables={nodeTables}
        onSubmit={onSubmitCreateNodeSchema}
      />
      {isNonEmpty(nodeTables) && (
        <CreateNodeDialog
          open={dialogStatus.createNode}
          nodes={nodes}
          nodeTables={nodeTables}
          nodeTablesMap={nodeTablesMap}
          onClose={onCloseCreateNode}
          onCreateSchemaClick={onCreateSchemaClickCreateNode}
        />
      )}
    </>
  );
}
