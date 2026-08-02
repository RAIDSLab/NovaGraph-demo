import {
  action,
  computed,
  makeObservable,
  observable,
  runInAction,
} from "mobx";
import { toast } from "sonner";

import {
  isEdgeSchema,
  isNodeSchema,
  type EdgeSchema,
  type GraphDatabase,
  type GraphEdge,
  type GraphNode,
  type GraphSnapshotState,
  type NodeSchema,
  type VisualizationResponse,
} from "./types";
import {
  DEFAULT_GRAPH_RENDER_SETTINGS,
  GRAVITY,
  NODE_SIZE_SCALE,
  type Gravity,
  type GraphRenderSettings,
  type LinkVisibilityDistanceRange,
  type NodeSizeScale,
} from "./renderer/constant";
import type { BaseGraphAlgorithm } from "./algorithms/implementations";
import type { LayerSliceState } from "./layer-slice";

import { controller } from "~/MainController";

export type InitializedVisualizerStore = VisualizerStore & {
  database: NonNullable<VisualizerStore["database"]>;
};

/**
 * UI graph state owner. After any graph topology change, call
 * `controller.notifyIgraphGraphChanged(snapshot?)` from this store only.
 */
export default class VisualizerStore {
  // CONSTRUCTORS
  constructor() {
    makeObservable(this, {
      database: observable,
      databases: observable,
      gravity: observable,
      nodeSizeScale: observable,
      largeGraphEdgeThreshold: observable,
      defaultShowDynamicLabels: observable,
      linkVisibilityDistanceNear: observable,
      linkVisibilityDistanceFar: observable,
      simulationDecay: observable,
      autoPauseOnSimulationEnd: observable,
      linkVisibilityDistanceRange: computed,
      graphRenderSettings: computed,
      databaseDrawerStateMap: observable,
      initialize: action,
      cleanup: action,
      setDatabase: action,
      setGraphState: action,
      addAndSetDatabase: action,
      addDatabase: action,
      switchDatabase: action,
      deleteDatabase: action,
      setGravity: action,
      setNodeSizeScale: action,
      setLargeGraphEdgeThreshold: action,
      setDefaultShowDynamicLabels: action,
      setLinkVisibilityDistanceRange: action,
      setSimulationDecay: action,
      setAutoPauseOnSimulationEnd: action,
      resetGraphRenderSettings: action,
      setCode: action,
      setActiveAlgorithm: action,
      setActiveResponse: action,
      setLayerSlice: action,
      clearLayerSlice: action,
      setLayerSliceIndex: action,
    });
  }

  // OBSERVABLES
  controller = controller;
  database: GraphDatabase | null = null; // Currently active database
  databases: string[] = []; // List of database options available
  gravity: Gravity = GRAVITY.ZERO_GRAVITY;
  nodeSizeScale: NodeSizeScale = NODE_SIZE_SCALE.MEDIUM;
  largeGraphEdgeThreshold =
    DEFAULT_GRAPH_RENDER_SETTINGS.largeGraphEdgeThreshold;
  defaultShowDynamicLabels =
    DEFAULT_GRAPH_RENDER_SETTINGS.defaultShowDynamicLabels;
  linkVisibilityDistanceNear =
    DEFAULT_GRAPH_RENDER_SETTINGS.linkVisibilityDistanceRange[0];
  linkVisibilityDistanceFar =
    DEFAULT_GRAPH_RENDER_SETTINGS.linkVisibilityDistanceRange[1];
  simulationDecay = DEFAULT_GRAPH_RENDER_SETTINGS.simulationDecay;
  autoPauseOnSimulationEnd =
    DEFAULT_GRAPH_RENDER_SETTINGS.autoPauseOnSimulationEnd;
  databaseDrawerStateMap: Record<
    string,
    {
      code: string;
      activeAlgorithm: BaseGraphAlgorithm | null;
      activeResponse: VisualizationResponse | null;
      layerSlice: LayerSliceState | null;
    }
  > = {};

  // ACTIONS
  initialize = async () => {
    // Initialize Kuzu controller
    await this.controller.initSystem();

    // Set up recovery callback for persistent async mode to auto-refresh database list
    if (this.controller.db && typeof (this.controller.db as any).setRecoveryCallback === 'function') {
      (this.controller.db as any).setRecoveryCallback((info: {
        failedDatabase: string;
        switchedToDatabase: string;
        reason: string;
      }) => {
        console.log(`[VisualizerStore] Database recovery: ${info.failedDatabase} -> ${info.switchedToDatabase}`);
        // Show error notification after successfully connecting to the new database
        toast.error(
          `数据库错误: 从 "${info.failedDatabase}" 切换到 "${info.switchedToDatabase}"`,
          {
            description: info.reason,
            duration: 7000,
          }
        );
        // Refresh database list and current database when database is switched due to failure
        this.refreshDatabaseList();
      });
    }
    
    // Also listen for custom events in case callback is not set
    if (typeof window !== 'undefined') {
      window.addEventListener('kuzu-database-switched', ((event: CustomEvent) => {
        const detail = event.detail as {
          failedDatabase: string;
          switchedToDatabase: string;
          reason: string;
        };
        if (detail) {
          // Show error notification after successfully connecting to the new database
          toast.error(
            `数据库错误: 从 "${detail.failedDatabase}" 切换到 "${detail.switchedToDatabase}"`,
            {
              description: detail.reason,
              duration: 7000,
            }
          );
        }
        this.refreshDatabaseList();
      }) as EventListener);
    }

    const [rawGraph, rawDatabases, rawCurrentDatabaseName] = await Promise.all([
      this.controller.db.snapshotGraphState(),
      this.controller.db.listDatabases().catch(() => [] as string[]), // defaults to empty databases if error (now filters problematic databases)
      this.controller.db.getCurrentDatabaseName().catch(() => null), // defaults to null if error
    ]);

    // Define graph snapshot state
    const graphSnapshotState: GraphSnapshotState = {
      nodes: rawGraph?.nodes ?? [],
      edges: rawGraph?.edges ?? [],
      nodeTables: rawGraph?.nodeTables ?? [],
      edgeTables: rawGraph?.edgeTables ?? [],
      directed: rawGraph?.directed ?? true,
    };

    const currentDatabaseName =
      rawCurrentDatabaseName ?? rawDatabases[0] ?? null;

    const databases = this.buildDatabases([
      ...rawDatabases,
      currentDatabaseName,
    ]);
    databases.forEach((dbName) => {
      this.databaseDrawerStateMap[dbName] = {
        code: "",
        activeAlgorithm: null,
        activeResponse: null,
        layerSlice: null,
      };
    });

    const graph = this.buildGraphFromSnapshotState(graphSnapshotState);

    runInAction(() => {
      this.databases = databases;
      if (currentDatabaseName) {
        this.database = {
          name: currentDatabaseName,
          persistent: this.controller.db.isDatabasePersistent(currentDatabaseName),
          graph,
        };
      } else {
        this.database = null;
      }
    });

    if (currentDatabaseName) {
      this.controller.notifyIgraphGraphChanged(graphSnapshotState);
    }
  };

  cleanup = () => {
    // this.controller.cleanup();
  };

  setDatabase = (database: GraphDatabase) => {
    this.database = database;
  };

  setGraphState = (snapshot: GraphSnapshotState) => {
    this.checkInitialization();

    const graph = this.buildGraphFromSnapshotState({
      ...snapshot,
      // If caller没有提供 directed，就沿用当前图的 directed，避免误把无向图重置为有向
      directed: snapshot.directed ?? this.database?.graph.directed ?? true,
    });

    runInAction(() => {
      this.database = {
        ...this.database,
        graph,
      };
    });

    this.controller.notifyIgraphGraphChanged({
      nodes: snapshot.nodes,
      edges: snapshot.edges,
      nodeTables: snapshot.nodeTables,
      edgeTables: snapshot.edgeTables,
      directed: snapshot.directed ?? this.database.graph.directed,
    });
  };

  addAndSetDatabase = (name: string, snapshot: GraphSnapshotState, persistent: boolean = true) => {
    const graph = this.buildGraphFromSnapshotState({
      nodes: snapshot?.nodes ?? [],
      edges: snapshot?.edges ?? [],
      nodeTables: snapshot?.nodeTables ?? [],
      edgeTables: snapshot?.edgeTables ?? [],
      directed: snapshot?.directed ?? true,
    });
    runInAction(() => {
      this.database = {
        name,
        persistent,
        graph,
      };
      this.addDatabase(name);
    });

    this.controller.notifyIgraphGraphChanged({
      nodes: snapshot?.nodes ?? [],
      edges: snapshot?.edges ?? [],
      nodeTables: snapshot?.nodeTables ?? [],
      edgeTables: snapshot?.edgeTables ?? [],
      directed: snapshot?.directed ?? true,
    });
  };

  addDatabase = (database: string) => {
    runInAction(() => {
      this.databases = this.buildDatabases([...this.databases, database]);
      this.databaseDrawerStateMap[database] = {
        code: "",
        activeAlgorithm: null,
        activeResponse: null,
        layerSlice: null,
      };
    });
  };

  switchDatabase = async (name: string) => {
    await this.controller.db.connectToDatabase(name);

    // Define graph state of new database
    const rawGraph = await this.controller.db.snapshotGraphState();
    const graph = this.buildGraphFromSnapshotState({
      nodes: rawGraph?.nodes ?? [],
      edges: rawGraph?.edges ?? [],
      nodeTables: rawGraph?.nodeTables ?? [],
      edgeTables: rawGraph?.edgeTables ?? [],
      directed: rawGraph?.directed ?? true,
    });

    // Refresh database list to ensure it's up to date (filters out problematic databases)
    const updatedDatabases = await this.controller.db.listDatabases().catch(() => [] as string[]);
    const currentDatabaseName = await this.controller.db.getCurrentDatabaseName().catch(() => null);

    const graphSnapshotState: GraphSnapshotState = {
      nodes: rawGraph?.nodes ?? [],
      edges: rawGraph?.edges ?? [],
      nodeTables: rawGraph?.nodeTables ?? [],
      edgeTables: rawGraph?.edgeTables ?? [],
      directed: rawGraph?.directed ?? true,
    };

    runInAction(() => {
      // Update database list
      this.databases = this.buildDatabases([
        ...updatedDatabases,
        currentDatabaseName,
      ]);
      
      // Update current database
      this.database = {
        name,
        persistent: this.controller.db.isDatabasePersistent(name),
        graph,
      };
    });

    this.controller.notifyIgraphGraphChanged(graphSnapshotState);
  };

  refreshDatabaseList = async () => {
    try {
      const [updatedDatabases, currentDatabaseName, rawGraph] = await Promise.all([
        this.controller.db.listDatabases().catch(() => [] as string[]),
        this.controller.db.getCurrentDatabaseName().catch(() => null),
        this.controller.db.snapshotGraphState().catch(() => null),
      ]);
      
      const graphSnapshotState: GraphSnapshotState = {
        nodes: rawGraph?.nodes ?? [],
        edges: rawGraph?.edges ?? [],
        nodeTables: rawGraph?.nodeTables ?? [],
        edgeTables: rawGraph?.edgeTables ?? [],
        directed: rawGraph?.directed ?? true,
      };
      
      const graph = this.buildGraphFromSnapshotState(graphSnapshotState);
      
      runInAction(() => {
        // Update database list
        this.databases = this.buildDatabases([
          ...updatedDatabases,
          currentDatabaseName,
        ]);
        
        // Update current database if it changed
        if (currentDatabaseName) {
          this.database = {
            name: currentDatabaseName,
            persistent: this.controller.db.isDatabasePersistent(currentDatabaseName),
            graph,
          };
        } else {
          this.database = null;
        }
      });

      if (currentDatabaseName && rawGraph) {
        this.controller.notifyIgraphGraphChanged(graphSnapshotState);
      }
    } catch (error) {
      console.warn("[VisualizerStore] Failed to refresh database list:", error);
    }
  };

  deleteDatabase = async (name: string) => {
    this.checkInitialization();

    await this.controller.db.deleteDatabase(name);
    
    // Refresh database list after deletion
    await this.refreshDatabaseList();
    runInAction(() => {
      this.databases = this.databases.filter(
        (databaseName) => databaseName !== name
      );
      delete this.databaseDrawerStateMap[name];
    });
  };

  setGravity = (gravity: Gravity) => {
    this.gravity = gravity;
  };

  setNodeSizeScale = (nodeSizeScale: NodeSizeScale) => {
    this.nodeSizeScale = nodeSizeScale;
  };

  get linkVisibilityDistanceRange(): LinkVisibilityDistanceRange {
    return [this.linkVisibilityDistanceNear, this.linkVisibilityDistanceFar];
  }

  get graphRenderSettings(): GraphRenderSettings {
    return {
      largeGraphEdgeThreshold: this.largeGraphEdgeThreshold,
      defaultShowDynamicLabels: this.defaultShowDynamicLabels,
      linkVisibilityDistanceRange: this.linkVisibilityDistanceRange,
      simulationDecay: this.simulationDecay,
      autoPauseOnSimulationEnd: this.autoPauseOnSimulationEnd,
    };
  }

  setLargeGraphEdgeThreshold = (value: number) => {
    this.largeGraphEdgeThreshold = Math.max(0, Math.floor(value));
  };

  setDefaultShowDynamicLabels = (value: boolean) => {
    this.defaultShowDynamicLabels = value;
  };

  setLinkVisibilityDistanceRange = (near: number, far: number) => {
    const n = Math.max(0, Math.floor(near));
    const f = Math.max(0, Math.floor(far));
    if (n >= f) {
      this.linkVisibilityDistanceNear = n;
      this.linkVisibilityDistanceFar = n + 1;
      return;
    }
    this.linkVisibilityDistanceNear = n;
    this.linkVisibilityDistanceFar = f;
  };

  setSimulationDecay = (value: number) => {
    this.simulationDecay = Math.min(200_000, Math.max(100, Math.floor(value)));
  };

  setAutoPauseOnSimulationEnd = (value: boolean) => {
    this.autoPauseOnSimulationEnd = value;
  };

  resetGraphRenderSettings = () => {
    const d = DEFAULT_GRAPH_RENDER_SETTINGS;
    this.largeGraphEdgeThreshold = d.largeGraphEdgeThreshold;
    this.defaultShowDynamicLabels = d.defaultShowDynamicLabels;
    this.linkVisibilityDistanceNear = d.linkVisibilityDistanceRange[0];
    this.linkVisibilityDistanceFar = d.linkVisibilityDistanceRange[1];
    this.simulationDecay = d.simulationDecay;
    this.autoPauseOnSimulationEnd = d.autoPauseOnSimulationEnd;
  };

  setCode = (code: string) => {
    if (this.database == null) return;
    this.databaseDrawerStateMap[this.database.name].code = code;
  };

  setActiveAlgorithm = (activeAlgorithm: BaseGraphAlgorithm | null) => {
    if (this.database == null) return;
    this.databaseDrawerStateMap[this.database.name].activeAlgorithm =
      activeAlgorithm;
  };

  setActiveResponse = (activeResponse: VisualizationResponse | null) => {
    if (this.database == null) return;
    const drawer = this.databaseDrawerStateMap[this.database.name];
    drawer.activeResponse = activeResponse;
    drawer.layerSlice = null;
  };

  setLayerSlice = (layerSlice: LayerSliceState | null) => {
    if (this.database == null) return;
    this.databaseDrawerStateMap[this.database.name].layerSlice = layerSlice;
  };

  clearLayerSlice = () => {
    if (this.database == null) return;
    this.databaseDrawerStateMap[this.database.name].layerSlice = null;
  };

  setLayerSliceIndex = (currentIndex: number) => {
    if (this.database == null) return;
    const slice = this.databaseDrawerStateMap[this.database.name].layerSlice;
    if (!slice || !slice.active || slice.steps.length === 0) return;
    const clamped = Math.min(
      Math.max(currentIndex, 0),
      slice.steps.length - 1
    );
    this.databaseDrawerStateMap[this.database.name].layerSlice = {
      ...slice,
      currentIndex: clamped,
    };
  };

  // UTILITIES FUNCTION
  protected checkInitialization(): asserts this is InitializedVisualizerStore {
    if (!this.database) {
      throw new Error("Database is not initialized");
    }
  }

  private buildNodeTablesWithMap(nodeTables: NodeSchema[]) {
    const builtNodeTables: NodeSchema[] = [];
    const nodeTablesMap: Map<string, NodeSchema> = new Map();

    nodeTables.forEach((t) => {
      const newTable = {
        tableName: String(t.tableName),
        tableType: t.tableType,
        primaryKey: String(t.primaryKey),
        primaryKeyType: t.primaryKeyType,
        properties: t.properties,
      };

      if (isNodeSchema(newTable)) {
        builtNodeTables.push(newTable);
        nodeTablesMap.set(t.tableName, newTable);
      }
    });

    return { nodeTables: builtNodeTables, nodeTablesMap };
  }

  private buildEdgeTablesWithMap(edgeTables: EdgeSchema[]) {
    const builtEdgeTables: EdgeSchema[] = [];
    const edgeTablesMap: Map<string, EdgeSchema> = new Map();

    edgeTables.forEach((t) => {
      const newTable = {
        tableName: String(t.tableName),
        tableType: t.tableType,
        primaryKey: String(t.primaryKey),
        primaryKeyType: t.primaryKeyType,
        properties: t.properties,
        sourceTableName: String(t.sourceTableName),
        targetTableName: String(t.targetTableName),
      };

      if (isEdgeSchema(newTable)) {
        builtEdgeTables.push(newTable);
        edgeTablesMap.set(t.tableName, newTable);
      }
    });

    return { edgeTables: builtEdgeTables, edgeTablesMap };
  }

  private buildNodesWithMap(nodes: GraphNode[]): {
    nodes: GraphNode[];
    nodesMap: Map<string, GraphNode>;
  } {
    const builtNodes: GraphNode[] = [];
    const nodesMap: Map<string, GraphNode> = new Map();

    nodes.forEach((n) => {
      const builtNode = {
        id: String(n.id),
        _primaryKey: String(n._primaryKey),
        _primaryKeyValue: n._primaryKeyValue,
        tableName: String(n.tableName),
        ...(n.attributes ? { attributes: n.attributes } : {}),
      };
      builtNodes.push(builtNode);
      nodesMap.set(n.id, builtNode);
    });

    return { nodes: builtNodes, nodesMap };
  }

  private buildEdgesWithMap(edges: GraphEdge[]): {
    edges: GraphEdge[];
    edgesMap: Map<[string, string], GraphEdge>;
  } {
    const builtEdges: GraphEdge[] = [];
    const edgesMap: Map<[string, string], GraphEdge> = new Map();

    edges.forEach((e) => {
      const source = String(e.source);
      const target = String(e.target);
      const builtEdge = {
        source,
        target,
        tableName: String(e.tableName),
        ...(e.attributes ? { attributes: e.attributes } : {}),
      };
      builtEdges.push(builtEdge);
      edgesMap.set([source, target], builtEdge);
    });

    return { edges: builtEdges, edgesMap };
  }

  private buildDatabases(databases: string[]) {
    return [...new Set(databases)].sort((a, b) => a.localeCompare(b));
  }

  private buildGraphFromSnapshotState(snapshot: GraphSnapshotState) {
    const { nodes, nodesMap } = this.buildNodesWithMap(snapshot.nodes);
    const { edges, edgesMap } = this.buildEdgesWithMap(snapshot.edges);
    const { nodeTables, nodeTablesMap } = this.buildNodeTablesWithMap(
      snapshot.nodeTables
    );
    const { edgeTables, edgeTablesMap } = this.buildEdgeTablesWithMap(
      snapshot.edgeTables
    );

    return {
      nodes,
      nodesMap,
      edges,
      edgesMap,
      nodeTables,
      nodeTablesMap,
      edgeTables,
      edgeTablesMap,
      directed: snapshot.directed ?? true,
    };
  }
}
