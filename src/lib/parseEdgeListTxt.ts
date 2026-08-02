/**
 * Parse a SNAP/NetworkX-style edge-list TXT into edges CSV.
 *
 * Supported lines:
 * - `#` comments and blank lines (ignored)
 * - `source target` or `source target weight` (whitespace-separated)
 *
 * The first data row determines whether the list is weighted (2 vs 3 columns);
 * all subsequent data rows must match that arity.
 */
export function parseEdgeListTxtToEdgesCsv(text: string): string {
  const dataRows = collectWhitespaceRows(text, "edge list");

  if (dataRows.length === 0) {
    throw new Error(
      "TXT edge list must contain at least one edge (non-comment) line"
    );
  }

  const normalized = dataRows.map((parts, index) => {
    if (parts.length < 2) {
      throw new Error(
        `Invalid edge-list line ${index + 1} (need at least source and target)`
      );
    }
    if (parts.length > 3) {
      return [parts[0], parts[1], parts[2]];
    }
    return parts;
  });

  const columnCount = normalized[0].length;
  if (columnCount !== 2 && columnCount !== 3) {
    throw new Error(
      "Each edge line must have 2 columns (source target) or 3 (source target weight)"
    );
  }

  for (let i = 1; i < normalized.length; i++) {
    if (normalized[i].length !== columnCount) {
      throw new Error(
        `Inconsistent column count on edge line ${i + 1}: expected ${columnCount}, got ${normalized[i].length}`
      );
    }
  }

  const header = columnCount === 3 ? "source,target,weight" : "source,target";
  const body = normalized.map((cols) => cols.join(","));
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
