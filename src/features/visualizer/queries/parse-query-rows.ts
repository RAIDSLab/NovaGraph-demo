export type ScalarValue = string | number | boolean | bigint | null;

export type NodeQueryCell = {
  kind: "node";
  kuzuId: string;
  label: string;
  raw: Record<string, unknown>;
};

export type EdgeQueryCell = {
  kind: "edge";
  sourceId: string;
  targetId: string;
  relLabel: string;
  raw: Record<string, unknown>;
};

export type ScalarQueryCell = {
  kind: "scalar";
  value: ScalarValue;
};

export type JsonQueryCell = {
  kind: "json";
  value: unknown;
};

export type ClassifiedCell =
  | NodeQueryCell
  | EdgeQueryCell
  | ScalarQueryCell
  | JsonQueryCell;

export type ParsedQueryRow = Record<string, ClassifiedCell>;

export type ParsedQueryRows = {
  columns: string[];
  rows: ParsedQueryRow[];
  uniqueNodeCount: number;
  uniqueEdgeCount: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatInternalId(id: unknown): string | null {
  if (!isRecord(id)) return null;
  if (id.table === undefined || id.offset === undefined) return null;
  return `${id.table}_${id.offset}`;
}

/**
 * Classify a single RETURN cell. Node/edge detection matches
 * queryResultColorMapExtraction: nodes have `_id`+`_label` and no `_src`/`_dst`;
 * edges also have `_src`/`_dst`. `_id` internals are only used to build kuzu ids.
 */
export function classifyQueryValue(value: unknown): ClassifiedCell {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return { kind: "scalar", value };
  }

  if (!isRecord(value)) {
    return { kind: "json", value };
  }

  const hasId = value._id != null;
  const hasLabel = value._label != null;
  const hasSrc = value._src != null;
  const hasDst = value._dst != null;

  if (hasId && hasLabel && !hasSrc && !hasDst) {
    const kuzuId = formatInternalId(value._id);
    if (kuzuId != null) {
      return {
        kind: "node",
        kuzuId,
        label: String(value._label),
        raw: value,
      };
    }
  }

  if (hasId && hasLabel && hasSrc && hasDst) {
    const sourceId = formatInternalId(value._src);
    const targetId = formatInternalId(value._dst);
    if (sourceId != null && targetId != null) {
      return {
        kind: "edge",
        sourceId,
        targetId,
        relLabel: String(value._label),
        raw: value,
      };
    }
  }

  return { kind: "json", value };
}

export function stringifyQueryValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "bigint") return String(value);
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  try {
    return JSON.stringify(value, (_, val) =>
      typeof val === "bigint" ? String(val) : val
    );
  } catch {
    return String(value);
  }
}

export function stringifyQueryCell(cell: ClassifiedCell): string {
  switch (cell.kind) {
    case "scalar":
      return stringifyQueryValue(cell.value);
    case "node":
      return `${cell.label} ${cell.kuzuId} ${stringifyQueryValue(cell.raw)}`;
    case "edge":
      return `${cell.relLabel} ${cell.sourceId} ${cell.targetId} ${stringifyQueryValue(cell.raw)}`;
    case "json":
      return stringifyQueryValue(cell.value);
  }
}

export function parseQueryRows(objects: unknown[]): ParsedQueryRows {
  const columns: string[] = [];
  const columnSeen = new Set<string>();
  const rows: ParsedQueryRow[] = [];
  const nodeIds = new Set<string>();
  const edgeKeys = new Set<string>();

  for (const object of objects) {
    if (!isRecord(object)) continue;

    const row: ParsedQueryRow = {};
    for (const key of Object.keys(object)) {
      if (!columnSeen.has(key)) {
        columnSeen.add(key);
        columns.push(key);
      }
      const cell = classifyQueryValue(object[key]);
      row[key] = cell;
      if (cell.kind === "node") {
        nodeIds.add(cell.kuzuId);
      } else if (cell.kind === "edge") {
        edgeKeys.add(`${cell.sourceId}-${cell.targetId}`);
      }
    }
    rows.push(row);
  }

  const missing: ClassifiedCell = { kind: "scalar", value: null };
  for (const row of rows) {
    for (const column of columns) {
      if (!(column in row)) {
        row[column] = missing;
      }
    }
  }

  return {
    columns,
    rows,
    uniqueNodeCount: nodeIds.size,
    uniqueEdgeCount: edgeKeys.size,
  };
}
