import kuzuController from "./kuzu/controllers/KuzuController";
import type { CompositeType } from "./kuzu/types/KuzuDBTypes";
import type { EdgeSchema, GraphNode } from "./features/visualizer/types";
import type {
  NonPrimaryKeyType,
  PrimaryKeyType,
} from "./features/visualizer/schema-inputs";
import type { InputChangeResult } from "./features/visualizer/inputs";
import { IgraphController } from "./igraph/IgraphController";
import { InMemoryGraphManager } from "./lib/InMemoryGraphManager";
import type { GraphSnapshotState } from "./features/visualizer/types";

/** Database facade surface exposed as `controller.db`. Methods are bound to MainController. */
export type MainControllerDb = {
  getGraphDirection: () => boolean;
  createNodeSchema: (
    tableName: string,
    primaryKey: string,
    primaryKeyType: PrimaryKeyType,
    properties?: {
      name: string;
      type: NonPrimaryKeyType;
      isPrimary?: boolean;
    }[],
    relInfo?: { from: string; to: string } | null
  ) => Promise<unknown>;
  createSchema: (
    type: "node" | "rel" | "NODE" | "REL",
    tableName: string,
    primaryKey?: string,
    properties?: Record<string, CompositeType>,
    relInfo?: { from: string; to: string } | null
  ) => Promise<unknown>;
  createNode: (
    label: string,
    properties: Record<
      string,
      { value: any; success?: boolean; message?: string }
    >
  ) => Promise<unknown>;
  updateNode: (
    node: GraphNode,
    values: Record<string, InputChangeResult<any>>
  ) => Promise<unknown>;
  deleteNode: (node: GraphNode) => Promise<unknown>;
  executeQuery: (query: string) => Promise<unknown>;
  executeCliQuery: (query: string) => Promise<unknown>;
  getColumnTypes: (query: string) => Promise<unknown>;
  snapshotGraphState: () => Promise<GraphSnapshotState & { directed: boolean }>;
  createEdgeSchema: (
    tableName: string,
    tablePairs: Array<[string | number, string | number]>,
    properties: (
      | { name: string; type: NonPrimaryKeyType }
      | { name: string; type: PrimaryKeyType }
    )[],
    relationshipType?: "MANY_ONE" | "ONE_MANY" | "MANY_MANY" | "ONE_ONE"
  ) => Promise<unknown>;
  createEdge: (
    node1: GraphNode,
    node2: GraphNode,
    edgeTable: EdgeSchema,
    attributes?: Record<string, InputChangeResult<any>>
  ) => Promise<unknown>;
  deleteEdge: (
    node1: GraphNode,
    node2: GraphNode,
    isDirected: boolean,
    edgeTableName: string
  ) => Promise<unknown>;
  updateEdge: (
    node1: GraphNode,
    node2: GraphNode,
    edgeTableName: string,
    values: Record<string, InputChangeResult<any>>
  ) => Promise<unknown>;
  writeVirtualFile: (path: string, content: string) => Promise<unknown>;
  deleteVirtualFile: (path: string) => Promise<unknown>;
  createDatabase: (
    dbName: string,
    metadata?: { isDirected?: boolean; persistent?: boolean }
  ) => Promise<unknown>;
  deleteDatabase: (dbName: string) => Promise<unknown>;
  listDatabases: () => Promise<string[]>;
  connectToDatabase: (dbName: string) => Promise<unknown>;
  getCurrentDatabaseName: () => Promise<string | null>;
  saveDatabase: () => Promise<unknown>;
  loadDatabase: () => Promise<unknown>;
  importFromCSV: (
    databaseName: string,
    nodesText: string,
    edgesText: string,
    nodeTableName: string,
    edgeTableName: string,
    isDirected?: boolean,
    persistent?: boolean
  ) => Promise<unknown>;
  importFromJSON: (
    databaseName: string,
    nodesText: string,
    edgesText: string,
    nodeTableName: string,
    edgeTableName: string,
    isDirected?: boolean,
    persistent?: boolean
  ) => Promise<unknown>;
};

class MainController {
  private _IgraphController: undefined | IgraphController;
  private _inMemoryGraphManager: InMemoryGraphManager | null = null;
  private _currentDatabasePersistent: boolean = true;

  /** Bound in constructor — all methods use MainController as `this`. */
  db!: MainControllerDb;

  private async _initKuzu() {
    const getEnv = (key: string): string | undefined => {
      if (typeof process !== "undefined" && process.env) {
        return process.env[key];
      }
      if (typeof import.meta !== "undefined" && import.meta.env) {
        return (
          (import.meta.env as any)[key] ||
          (import.meta.env as any)[`VITE_${key}`]
        );
      }
      return undefined;
    };

    const kuzuType = (getEnv("KUZU_TYPE") || "persistent").toLowerCase();
    const kuzuMode = (getEnv("KUZU_MODE") || "async").toLowerCase();
    const dbPath = getEnv("KUZU_DB_PATH");

    const validTypes = ["inmemory", "persistent"];
    const validModes = ["sync", "async"];

    if (!validTypes.includes(kuzuType)) {
      console.warn(
        `Invalid KUZU_TYPE: ${kuzuType}. Valid values are: ${validTypes.join(", ")}. Using default: persistent`
      );
    }

    if (!validModes.includes(kuzuMode)) {
      console.warn(
        `Invalid KUZU_MODE: ${kuzuMode}. Valid values are: ${validModes.join(", ")}. Using default: async`
      );
    }

    const finalType = validTypes.includes(kuzuType) ? kuzuType : "persistent";
    const finalMode = validModes.includes(kuzuMode) ? kuzuMode : "async";

    const options: { dbPath?: string; dbOptions?: Record<string, any> } = {};
    if (dbPath) {
      options.dbPath = dbPath;
    }

    console.log(
      `Initializing Kuzu with type: ${finalType}, mode: ${finalMode}${dbPath ? `, dbPath: ${dbPath}` : ""}`
    );

    return kuzuController.initialize(finalType, finalMode, options);
  }

  private async _initIgraph() {
    return await this._IgraphController?.initIgraph();
  }

  private _createIgraphController(): IgraphController {
    return new IgraphController(
      this._snapshotGraphState.bind(this),
      this._getGraphDirection.bind(this)
    );
  }

  constructor() {
    this.db = {
      getGraphDirection: this._getGraphDirection.bind(this),
      createNodeSchema: this._createNodeSchema.bind(this),
      createSchema: this._createSchema.bind(this),
      createNode: this._createNode.bind(this),
      updateNode: this._updateNode.bind(this),
      deleteNode: this._deleteNode.bind(this),
      executeQuery: this._executeQuery.bind(this),
      executeCliQuery: this._executeCliQuery.bind(this),
      getColumnTypes: this._getColumnTypes.bind(this),
      snapshotGraphState: this._snapshotGraphState.bind(this),
      createEdgeSchema: this._createEdgeSchema.bind(this),
      createEdge: this._createEdge.bind(this),
      deleteEdge: this._deleteEdge.bind(this),
      updateEdge: this._updateEdge.bind(this),
      writeVirtualFile: this._writeVirtualFile.bind(this),
      deleteVirtualFile: this._deleteVirtualFile.bind(this),
      createDatabase: this._createDatabase.bind(this),
      deleteDatabase: this._deleteDatabase.bind(this),
      listDatabases: this._listDatabases.bind(this),
      connectToDatabase: this._connectToDatabase.bind(this),
      getCurrentDatabaseName: this._getCurrentDatabaseName.bind(this),
      saveDatabase: this._saveDatabase.bind(this),
      loadDatabase: this._loadDatabase.bind(this),
      importFromCSV: this._importFromCSV.bind(this),
      importFromJSON: this._importFromJSON.bind(this),
    };

    this._IgraphController = this._createIgraphController();
  }

  async getGraphModule() {
    return this._IgraphController?.getIgraphModule();
  }

  async initSystem() {
    await this._initKuzu();
    await this._initIgraph();
  }

  getAlgorithm() {
    if (this._IgraphController === undefined) {
      throw new Error("IgraphController is undefinned");
    }
    return this._IgraphController;
  }

  /**
   * Invalidate igraph worker graph cache and optionally schedule a background sync.
   *
   * **Contract:** Call only from `VisualizerStore` after the UI graph state changes
   * (`initialize`, `switchDatabase`, `setGraphState`, `addAndSetDatabase`,
   * `refreshDatabaseList`). Do not call from `db.*` or import handlers — pass
   * `snapshot` from the store to avoid an extra Kuzu `snapshotGraphState()` copy.
   */
  notifyIgraphGraphChanged(snapshot?: GraphSnapshotState) {
    const igraph = this._IgraphController;
    if (!igraph) return;
    igraph.invalidateGraphSync();
    if (snapshot) {
      igraph.scheduleBackgroundGraphSync(
        IgraphController.toWorkerSnapshot(snapshot)
      );
    } else {
      igraph.scheduleBackgroundGraphSync();
    }
  }

  private _getGraphDirection(): boolean {
    if (!this._currentDatabasePersistent && this._inMemoryGraphManager) {
      return this._inMemoryGraphManager.getGraphDirection();
    }
    const metadata = kuzuController.getCurrentDatabaseMetadata?.();
    return metadata?.isDirected ?? true;
  }

  private async _createNodeSchema(
    tableName: string,
    primaryKey: string,
    primaryKeyType: PrimaryKeyType,
    properties: {
      name: string;
      type: NonPrimaryKeyType;
      isPrimary?: boolean;
    }[] = [],
    relInfo: { from: string; to: string } | null = null
  ) {
    if (!this._currentDatabasePersistent && this._inMemoryGraphManager) {
      this._inMemoryGraphManager.createNodeSchema(
        tableName,
        primaryKey,
        primaryKeyType,
        properties
      );
      return undefined;
    }
    return kuzuController.createNodeSchema(
      tableName,
      primaryKey,
      primaryKeyType,
      properties,
      relInfo
    );
  }

  private async _createSchema(
    type: "node" | "rel" | "NODE" | "REL",
    tableName: string,
    primaryKey?: string,
    properties: Record<string, CompositeType> = {},
    relInfo: { from: string; to: string } | null = null
  ) {
    return kuzuController.createSchema(
      type,
      tableName,
      primaryKey,
      properties,
      relInfo
    );
  }

  private async _createNode(
    label: string,
    properties: Record<
      string,
      { value: any; success?: boolean; message?: string }
    >
  ) {
    if (!this._currentDatabasePersistent && this._inMemoryGraphManager) {
      return this._inMemoryGraphManager.createNode(label, properties);
    }
    return kuzuController.createNode(label, properties);
  }

  private async _updateNode(
    node: GraphNode,
    values: Record<string, InputChangeResult<any>>
  ) {
    if (!this._currentDatabasePersistent && this._inMemoryGraphManager) {
      return this._inMemoryGraphManager.updateNode(node, values);
    }
    return kuzuController.updateNode(node, values);
  }

  private async _deleteNode(node: GraphNode) {
    if (!this._currentDatabasePersistent && this._inMemoryGraphManager) {
      return this._inMemoryGraphManager.deleteNode(node);
    }
    return kuzuController.deleteNode(node);
  }

  private async _executeQuery(query: string) {
    if (!this._currentDatabasePersistent) {
      throw new Error(
        "Query execution is not supported for in-memory (non-persistent) graphs. " +
          "Please use a persistent graph to execute queries."
      );
    }
    const result = await kuzuController.executeQuery(query);
    return {
      ...result,
      directed: this._getGraphDirection(),
    };
  }

  private async _executeCliQuery(query: string) {
    if (!this._currentDatabasePersistent) {
      throw new Error(
        "Query execution is not supported for in-memory (non-persistent) graphs. " +
          "Please use a persistent graph to execute queries."
      );
    }
    const result = await kuzuController.executeCliQuery(query);
    return {
      ...result,
      directed: this._getGraphDirection(),
    };
  }

  private async _getColumnTypes(query: string) {
    if (!this._currentDatabasePersistent) {
      throw new Error(
        "Column type inference is not supported for in-memory (non-persistent) graphs. " +
          "Please use a persistent graph to infer column types."
      );
    }
    return kuzuController.getColumnTypes(query);
  }

  private async _snapshotGraphState() {
    if (!this._currentDatabasePersistent && this._inMemoryGraphManager) {
      const snapshot = this._inMemoryGraphManager.snapshotGraphState();
      return {
        ...snapshot,
        directed: this._getGraphDirection(),
      };
    }
    const snapshot = await kuzuController.snapshotGraphState();
    return {
      ...snapshot,
      directed: this._getGraphDirection(),
    };
  }

  private async _createEdgeSchema(
    tableName: string,
    tablePairs: Array<[string | number, string | number]>,
    properties: (
      | { name: string; type: NonPrimaryKeyType }
      | { name: string; type: PrimaryKeyType }
    )[],
    relationshipType?: "MANY_ONE" | "ONE_MANY" | "MANY_MANY" | "ONE_ONE"
  ) {
    if (!this._currentDatabasePersistent && this._inMemoryGraphManager) {
      this._inMemoryGraphManager.createEdgeSchema(
        tableName,
        tablePairs,
        properties,
        relationshipType
      );
      return undefined;
    }
    return kuzuController.createEdgeSchema(
      tableName,
      tablePairs,
      properties,
      this._getGraphDirection(),
      relationshipType
    );
  }

  private async _createEdge(
    node1: GraphNode,
    node2: GraphNode,
    edgeTable: EdgeSchema,
    attributes?: Record<string, InputChangeResult<any>>
  ) {
    if (!this._currentDatabasePersistent && this._inMemoryGraphManager) {
      return this._inMemoryGraphManager.createEdge(
        node1,
        node2,
        edgeTable,
        attributes
      );
    }
    return kuzuController.createEdge(
      node1,
      node2,
      edgeTable,
      this._getGraphDirection(),
      attributes
    );
  }

  private async _deleteEdge(
    node1: GraphNode,
    node2: GraphNode,
    isDirected: boolean,
    edgeTableName: string
  ) {
    if (!this._currentDatabasePersistent && this._inMemoryGraphManager) {
      return this._inMemoryGraphManager.deleteEdge(
        node1,
        node2,
        edgeTableName
      );
    }
    return kuzuController.deleteEdge(node1, node2, edgeTableName, isDirected);
  }

  private async _updateEdge(
    node1: GraphNode,
    node2: GraphNode,
    edgeTableName: string,
    values: Record<string, InputChangeResult<any>>
  ) {
    if (!this._currentDatabasePersistent && this._inMemoryGraphManager) {
      return this._inMemoryGraphManager.updateEdge(
        node1,
        node2,
        edgeTableName,
        values
      );
    }
    return kuzuController.updateEdge(
      node1,
      node2,
      edgeTableName,
      values,
      this._getGraphDirection()
    );
  }

  private async _writeVirtualFile(path: string, content: string) {
    return kuzuController.writeVirtualFile(path, content);
  }

  private async _deleteVirtualFile(path: string) {
    return kuzuController.deleteVirtualFile(path);
  }

  private async _createDatabase(
    dbName: string,
    metadata?: { isDirected?: boolean; persistent?: boolean }
  ) {
    const persistent = metadata?.persistent ?? true;
    this._currentDatabasePersistent = persistent;

    if (!persistent) {
      this._inMemoryGraphManager = new InMemoryGraphManager(
        metadata?.isDirected ?? true
      );
      if (this._IgraphController) {
        await this._IgraphController.dispose();
        this._IgraphController = this._createIgraphController();
        await this._IgraphController.initIgraph();
      }
      return undefined;
    }

    return kuzuController.createDatabase(dbName, metadata);
  }

  private async _deleteDatabase(dbName: string) {
    return kuzuController.deleteDatabase(dbName);
  }

  private async _listDatabases() {
    return kuzuController.listDatabases();
  }

  private async _connectToDatabase(dbName: string) {
    this._currentDatabasePersistent = true;
    this._inMemoryGraphManager = null;
    return kuzuController.connectToDatabase(dbName);
  }

  private async _getCurrentDatabaseName() {
    return kuzuController.getCurrentDatabaseName();
  }

  private async _saveDatabase() {
    return kuzuController.saveDatabase();
  }

  private async _loadDatabase() {
    return kuzuController.loadDatabase();
  }

  private async _importFromCSV(
    databaseName: string,
    nodesText: string,
    edgesText: string,
    nodeTableName: string,
    edgeTableName: string,
    isDirected: boolean = true,
    persistent: boolean = true
  ) {
    if (!persistent && this._inMemoryGraphManager) {
      const snapshot = await this._inMemoryGraphManager.importFromCSV(
        nodesText,
        edgesText,
        nodeTableName,
        edgeTableName,
        isDirected
      );
      return {
        databaseName,
        ...snapshot,
      };
    }

    const result = await kuzuController.importFromCSV(
      databaseName,
      nodesText,
      edgesText,
      nodeTableName,
      edgeTableName,
      isDirected
    );

    return {
      ...result,
      directed: isDirected,
    };
  }

  private async _importFromJSON(
    databaseName: string,
    nodesText: string,
    edgesText: string,
    nodeTableName: string,
    edgeTableName: string,
    isDirected: boolean = true,
    persistent: boolean = true
  ) {
    if (!persistent && this._inMemoryGraphManager) {
      const snapshot = await this._inMemoryGraphManager.importFromJSON(
        nodesText,
        edgesText,
        nodeTableName,
        edgeTableName,
        isDirected
      );
      return {
        databaseName,
        ...snapshot,
      };
    }

    const result = await kuzuController.importFromJSON(
      databaseName,
      nodesText,
      edgesText,
      nodeTableName,
      edgeTableName,
      isDirected
    );

    return {
      ...result,
      directed: isDirected,
    };
  }

  _internal = {
    async getSingleSchemaProperties(tableName: string) {
      return kuzuController.getSingleSchemaProperties(tableName);
    },

    async getAllSchemaProperties() {
      return kuzuController.getAllSchemaProperties();
    },
  };
}

const controller = new MainController();
export { controller };
