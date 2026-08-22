/**
 * Parse a SNAP/NetworkX-style edge-list TXT into edges CSV.
 *
 * Supported lines:
 * - `#` comments and blank lines (ignored)
 * - `source target` or `source target weight` (whitespace-separated)
 * - CSV-style `source,target` / `source, target` / `source,target,weight`
 * - Optional header row with endpoint aliases; extra columns (e.g. link_id)
 *   are kept as edge properties
 *
 * Without a header, the first data row determines whether the list is
 * weighted (2 vs 3 columns); all subsequent data rows must match that arity.
 */

import { resolveEndpointColumns } from "./resolveEdgeEndpoints";

export function parseEdgeListTxtToEdgesCsv(text: string): string {
  const rawLines = text.split(/\r?\n/);
  const dataRows: string[][] = [];
  let headerParts: string[] | null = null;

  for (let lineNo = 0; lineNo < rawLines.length; lineNo++) {
    const raw = rawLines[lineNo];
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    const parts = splitEdgeListLine(line);
    if (parts.length === 0) {
      throw new Error(`Invalid empty edge-list line ${lineNo + 1}: "${raw}"`);
    }

    // Optional CSV/TXT header like "source,target" or "link_id,source,target"
    if (
      headerParts === null &&
      dataRows.length === 0 &&
      looksLikeEndpointHeader(parts)
    ) {
      headerParts = parts;
      continue;
    }

    if (parts.length < 2) {
      throw new Error(
        `Invalid edge-list line ${lineNo + 1}: expected at least 2 endpoint values (e.g. "0 1" or "0,1"), got "${line}"`
      );
    }

    if (headerParts) {
      dataRows.push(parts);
    } else {
      dataRows.push(parts.length > 3 ? [parts[0], parts[1], parts[2]] : parts);
    }
  }

  if (dataRows.length === 0) {
    throw new Error(
      "TXT edge list must contain at least one edge (non-comment) line"
    );
  }

  if (headerParts) {
    const columnCount = headerParts.length;
    for (let i = 0; i < dataRows.length; i++) {
      if (dataRows[i].length !== columnCount) {
        throw new Error(
          `Inconsistent column count on edge line ${i + 1}: expected ${columnCount} (from header), got ${dataRows[i].length}`
        );
      }
    }
    const body = dataRows.map((cols) => cols.join(","));
    return [headerParts.join(","), ...body].join("\n");
  }

  const columnCount = dataRows[0].length;
  if (columnCount !== 2 && columnCount !== 3) {
    throw new Error(
      "Each edge line must have 2 columns (source target) or 3 (source target weight)"
    );
  }

  for (let i = 1; i < dataRows.length; i++) {
    if (dataRows[i].length !== columnCount) {
      throw new Error(
        `Inconsistent column count on edge line ${i + 1}: expected ${columnCount}, got ${dataRows[i].length}`
      );
    }
  }

  const header = columnCount === 3 ? "source,target,weight" : "source,target";
  const body = dataRows.map((cols) => cols.join(","));
  return [header, ...body].join("\n");
}

/**
 * Parse a whitespace-separated nodes TXT into nodes CSV.
 *
 * Supported lines:
 * - `#` comments and blank lines (ignored)
 * - One ID per line → CSV with header `id`
 * - Multiple columns → first non-comment line is the header; remaining lines are values
 *   (first column is the primary key)
 */
export function parseNodesTxtToNodesCsv(text: string): string {
  const rows = collectWhitespaceRows(text, "nodes file");

  if (rows.length === 0) {
    throw new Error(
      "TXT nodes file must contain at least one node (non-comment) line"
    );
  }

  const columnCount = rows[0].length;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].length !== columnCount) {
      throw new Error(
        `Inconsistent column count on node line ${i + 1}: expected ${columnCount}, got ${rows[i].length}`
      );
    }
  }

  if (columnCount === 1) {
    return ["id", ...rows.map((r) => r[0])].join("\n");
  }

  // Multi-column: first row is the header
  if (rows.length < 2) {
    throw new Error(
      "Multi-column nodes.txt needs a header row and at least one data row"
    );
  }

  const header = rows[0];
  for (const name of header) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      throw new Error(
        `Invalid nodes header column "${name}". Use identifiers like id, name, age`
      );
    }
  }

  const body = rows.slice(1).map((cols) => cols.join(","));
  return [header.join(","), ...body].join("\n");
}

/** Split an edge-list line on commas if present, otherwise on whitespace. */
function splitEdgeListLine(line: string): string[] {
  if (line.includes(",")) {
    return line
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }
  return line.split(/\s+/).filter(Boolean);
}

function looksLikeEndpointHeader(parts: string[]): boolean {
  if (parts.length < 2) return false;
  // Numeric-looking tokens are data, not headers
  if (parts.every((p) => /^-?\d+(\.\d+)?$/.test(p))) return false;
  try {
    resolveEndpointColumns(parts);
    return true;
  } catch {
    return false;
  }
}

function collectWhitespaceRows(text: string, label: string): string[][] {
  const rawLines = text.split(/\r?\n/);
  const rows: string[][] = [];

  for (const raw of rawLines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    const parts = line.split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      throw new Error(`Invalid empty ${label} line: "${raw}"`);
    }
    rows.push(parts);
  }

  return rows;
}

export function validateEdgeListTxt(text: string): {
  success: boolean;
  message?: string;
} {
  try {
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
}

export function validateNodesTxt(text: string): {
  success: boolean;
  message?: string;
} {
  try {
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
}
