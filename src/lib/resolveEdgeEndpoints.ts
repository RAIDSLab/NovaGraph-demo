/**
 * Resolve CSV edge endpoint columns from common header aliases
 * and normalize them to canonical `source` / `target`.
 *
 * Matching is case-insensitive and ignores `_` / `-` / spaces in names.
 * After exact matches, distinctive aliases also match as suffixes
 * (e.g. txId1/txId2 → id1/id2).
 */

export type EndpointColumns = {
  sourceIdx: number;
  targetIdx: number;
  sourceName: string;
  targetName: string;
};

/** Ordered pairs: first matching pair wins (case-insensitive). */
const ENDPOINT_ALIAS_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["source", "target"],
  ["from", "to"],
  ["src", "dst"],
  ["id1", "id2"],
  ["node1", "node2"],
  ["start", "end"],
  ["u", "v"],
  ["origin", "destination"],
  ["1", "2"],
];

/** Short / ambiguous aliases: exact match only (no suffix). */
const EXACT_ONLY_ALIASES = new Set(["u", "v", "to", "end", "1", "2"]);

/**
 * Compacted header names that identify the edge itself, never an endpoint.
 * Exact match only so txId1 / id1 still resolve as endpoints.
 */
const EDGE_IDENTIFIER_NAMES = new Set(["id", "edgeid", "linkid", "relid", "eid"]);

function normalizeHeaderName(name: string): string {
  return name.trim().toLowerCase();
}

/** Lowercase and strip separators so tx_Id-1 → txid1. */
function compactHeaderName(name: string): string {
  return normalizeHeaderName(name).replace(/[_\-\s]/g, "");
}

function isEdgeIdentifierColumn(compactedName: string): boolean {
  return EDGE_IDENTIFIER_NAMES.has(compactedName);
}

function findColumnIndex(
  compacted: string[],
  alias: string,
  allowSuffix: boolean,
  used: Set<number>
): number {
  const exact = compacted.findIndex(
    (c, i) => !used.has(i) && !isEdgeIdentifierColumn(c) && c === alias
  );
  if (exact !== -1) return exact;

  if (!allowSuffix || EXACT_ONLY_ALIASES.has(alias)) {
    return -1;
  }

  // Prefer longer leftover prefixes; require a non-empty prefix for suffix matches
  let bestIdx = -1;
  let bestPrefixLen = -1;
  for (let i = 0; i < compacted.length; i++) {
    if (used.has(i) || isEdgeIdentifierColumn(compacted[i])) continue;
    const name = compacted[i];
    if (name.length <= alias.length) continue;
    if (!name.endsWith(alias)) continue;
    const prefixLen = name.length - alias.length;
    if (prefixLen > bestPrefixLen) {
      bestPrefixLen = prefixLen;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Find endpoint columns among CSV headers.
 * @throws if no recognized alias pair is present
 */
export function resolveEndpointColumns(headers: string[]): EndpointColumns {
  const compacted = headers.map(compactHeaderName);

  for (const [sourceAlias, targetAlias] of ENDPOINT_ALIAS_PAIRS) {
    const used = new Set<number>();

    const sourceIdx = findColumnIndex(
      compacted,
      sourceAlias,
      !EXACT_ONLY_ALIASES.has(sourceAlias),
      used
    );
    if (sourceIdx === -1) continue;
    used.add(sourceIdx);

    const targetIdx = findColumnIndex(
      compacted,
      targetAlias,
      !EXACT_ONLY_ALIASES.has(targetAlias),
      used
    );
    if (targetIdx === -1) continue;

    return {
      sourceIdx,
      targetIdx,
      sourceName: headers[sourceIdx].trim(),
      targetName: headers[targetIdx].trim(),
    };
  }

  throw new Error(
    "Edges file must have endpoint columns in the header (e.g. source/target, from/to, id1/id2, txId1/txId2, or 1/2)"
  );
}

/**
 * Rewrite edge CSV so endpoint columns are named `source` and `target`
 * and occupy the first two columns (required by Kuzu COPY REL).
 * Remaining columns keep their original names and relative order.
 */
export function normalizeEdgesCsvText(edgesText: string): string {
  const lines = edgesText.trim().split("\n");
  if (lines.length < 1) {
    throw new Error("Edges CSV is empty");
  }

  const headerLine = lines[0].trim();
  const headers = headerLine.split(",").map((col) => col.trim());
  const { sourceIdx, targetIdx } = resolveEndpointColumns(headers);

  const restIdx = headers
    .map((_, i) => i)
    .filter((i) => i !== sourceIdx && i !== targetIdx);
  const order = [sourceIdx, targetIdx, ...restIdx];

  const nextHeaders = order.map((i, pos) => {
    if (pos === 0) return "source";
    if (pos === 1) return "target";
    return headers[i];
  });

  const nextRows = lines.slice(1).map((line) => {
    const values = line.split(",").map((col) => col.trim());
    return order.map((i) => values[i] ?? "").join(",");
  });

  return [nextHeaders.join(","), ...nextRows].join("\n");
}

export const EDGE_ENDPOINT_ALIAS_HELP =
  "Endpoint columns may be named source/target, from/to, src/dst, id1/id2 (including prefixes like txId1/txId2), node1/node2, start/end, u/v, origin/destination, or 1/2. Matching is case-insensitive and ignores underscores/hyphens. Extra columns such as link_id or edge_id are kept as edge properties and may appear in any position.";
