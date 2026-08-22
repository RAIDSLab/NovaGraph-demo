export type QueryAssistNode = {
  tableName: string;
  _primaryKey: string;
  _primaryKeyValue: unknown;
  attributes?: Record<string, unknown>;
};

export type QueryAssistEdge = {
  tableName: string;
  attributes?: Record<string, unknown>;
};

export type QueryAssistTable = {
  tableName: string;
  primaryKey: string;
  properties: Record<string, unknown>;
  sourceTableName?: string;
  targetTableName?: string;
};

export type QueryAssistGraph = {
  nodeTables: QueryAssistTable[];
  edgeTables: QueryAssistTable[];
  nodes: QueryAssistNode[];
  edges?: QueryAssistEdge[];
};

export type StarterChip = {
  id: string;
  label: string;
  query: string;
};

export type CompletionKind =
  | "keyword"
  | "label"
  | "property"
  | "value"
  | "snippet"
  | "variable"
  | "operator";

export type CompletionItem = {
  label: string;
  insert: string;
  kind: CompletionKind;
};

export type CompletionsResult = {
  from: number;
  to: number;
  items: CompletionItem[];
};

export const QUERY_KEYWORDS = [
  "MATCH",
  "RETURN",
  "WHERE",
  "CREATE",
  "DELETE",
  "SET",
  "WITH",
  "UNWIND",
  "LIMIT",
  "OPTIONAL",
  "ORDER",
  "BY",
  "SKIP",
  "DISTINCT",
  "AND",
  "OR",
  "NOT",
  "AS",
  "CONTAINS",
  "STARTS",
  "ENDS",
  "IN",
  "IS",
  "NULL",
  "EXISTS",
  "CALL",
  "UNION",
  "MERGE",
  "DETACH",
  "CASE",
  "WHEN",
  "THEN",
  "ELSE",
  "XOR",
] as const;

const KEYWORD_UPPER = new Set<string>(QUERY_KEYWORDS);

const CLAUSE_HEAD_LIST = [
  "MATCH",
  "OPTIONAL",
  "WHERE",
  "RETURN",
  "WITH",
  "CREATE",
  "MERGE",
  "SET",
  "DELETE",
  "DETACH",
  "UNWIND",
  "ORDER",
  "CALL",
  "UNION",
];

const CLAUSE_HEADS = new Set(CLAUSE_HEAD_LIST);

const COMPARISON_OPERATORS = new Set(["=", "<>", "<", ">", "<=", ">=", "=~"]);

const OPERATOR_SUGGESTIONS = [
  "=",
  "<>",
  "<",
  ">",
  "<=",
  ">=",
  "CONTAINS",
  "STARTS WITH",
  "ENDS WITH",
  "IN",
  "IS NULL",
  "IS NOT NULL",
];

const CONTINUATIONS_BY_CLAUSE: Record<string, string[]> = {
  WHERE: ["AND", "OR", "XOR", "RETURN", "ORDER BY", "LIMIT"],
  RETURN: ["AS", "ORDER BY", "LIMIT", "SKIP"],
  WITH: ["AS", "WHERE", "ORDER BY", "LIMIT", "SKIP"],
  MATCH: ["WHERE", "RETURN", "MATCH", "OPTIONAL MATCH"],
  ORDER: ["BY", "LIMIT", "SKIP"],
};

const DEFAULT_CONTINUATIONS = ["WHERE", "RETURN", "ORDER BY", "LIMIT"];

const PROJECTION_TAIL = ["AS", "ORDER BY", "LIMIT", "SKIP"];

const SIMPLE_IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const PK_VALUE_CAP = 50;

export function quoteIdent(name: string): string {
  if (SIMPLE_IDENT.test(name)) return name;
  return `\`${name.replace(/`/g, "``")}\``;
}

export function formatCypherLiteral(value: unknown): string {
  if (value == null) return "NULL";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "bigint") return String(value);
  const text = String(value);
  return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function placeholderQuery(graph: QueryAssistGraph): string {
  const label = graph.nodeTables[0]?.tableName ?? "Node";
  return `MATCH (n:${quoteIdent(label)}) RETURN n LIMIT 25`;
}

export function starterChips(graph: QueryAssistGraph): StarterChip[] {
  const chips: StarterChip[] = [];
  const nodeTable = graph.nodeTables[0];
  const label = nodeTable?.tableName ?? "Node";
  const quotedLabel = quoteIdent(label);

  chips.push({
    id: "match-nodes",
    label: `MATCH (n:${quotedLabel}) RETURN n`,
    query: `MATCH (n:${quotedLabel}) RETURN n LIMIT 25`,
  });

  const edgeTable = graph.edgeTables[0];
  if (edgeTable) {
    const src = quoteIdent(edgeTable.sourceTableName ?? label);
    const rel = quoteIdent(edgeTable.tableName);
    const dst = quoteIdent(edgeTable.targetTableName ?? label);
    chips.push({
      id: "match-path",
      label: `MATCH (a)-[r:${rel}]->(b)`,
      query: `MATCH (a:${src})-[r:${rel}]->(b:${dst}) RETURN a, r, b LIMIT 25`,
    });
  }

  if (nodeTable) {
    const example =
      graph.nodes.find((node) => node.tableName === nodeTable.tableName) ??
      graph.nodes[0];
    if (example) {
      const pk = example._primaryKey || nodeTable.primaryKey;
      chips.push({
        id: "match-where",
        label: `WHERE n.${quoteIdent(pk)} = …`,
        query: `MATCH (n:${quotedLabel}) WHERE n.${quoteIdent(pk)} = ${formatCypherLiteral(example._primaryKeyValue)} RETURN n`,
      });
    }
  }

  return chips.slice(0, 3);
}

function isIdentChar(char: string): boolean {
  return /[A-Za-z0-9_`]/.test(char);
}

export function tokenRangeAtCursor(
  code: string,
  cursor: number
): { from: number; to: number; prefix: string } {
  const clamped = Math.max(0, Math.min(cursor, code.length));
  let from = clamped;
  while (from > 0 && isIdentChar(code[from - 1]!)) from--;
  let to = clamped;
  while (to < code.length && isIdentChar(code[to]!)) to++;
  return {
    from,
    to,
    prefix: code.slice(from, clamped).replace(/`/g, ""),
  };
}

export type TokenKind =
  | "string"
  | "number"
  | "ident"
  | "keyword"
  | "punct"
  | "comment";

export type Token = {
  kind: TokenKind;
  value: string;
  from: number;
  to: number;
  unterminated?: boolean;
};

const TWO_CHAR_PUNCT = ["->", "<-", "<>", "<=", ">=", "=~", "||"];

function readQuoted(
  code: string,
  start: number,
  quote: string
): { to: number; unterminated: boolean } {
  let i = start + 1;
  while (i < code.length) {
    const char = code[i]!;
    if (char === "\\") {
      i += 2;
      continue;
    }
    if (char === quote) return { to: i + 1, unterminated: false };
    if (quote !== "`" && char === "\n") return { to: i, unterminated: true };
    i += 1;
  }
  return { to: code.length, unterminated: true };
}

export function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < code.length) {
    const char = code[i]!;

    if (/\s/.test(char)) {
      i += 1;
      continue;
    }

    if (char === "/" && code[i + 1] === "/") {
      const newline = code.indexOf("\n", i);
      const to = newline === -1 ? code.length : newline;
      tokens.push({
        kind: "comment",
        value: code.slice(i, to),
        from: i,
        to,
        unterminated: true,
      });
      i = to;
      continue;
    }

    if (char === "/" && code[i + 1] === "*") {
      const close = code.indexOf("*/", i + 2);
      const to = close === -1 ? code.length : close + 2;
      tokens.push({
        kind: "comment",
        value: code.slice(i, to),
        from: i,
        to,
        unterminated: close === -1,
      });
      i = to;
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      const { to, unterminated } = readQuoted(code, i, char);
      tokens.push({
        kind: char === "`" ? "ident" : "string",
        value: code.slice(i, to),
        from: i,
        to,
        unterminated,
      });
      i = to;
      continue;
    }

    if (/[0-9]/.test(char)) {
      let to = i;
      while (to < code.length && /[0-9.]/.test(code[to]!)) to += 1;
      tokens.push({ kind: "number", value: code.slice(i, to), from: i, to });
      i = to;
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      let to = i;
      while (to < code.length && /[A-Za-z0-9_]/.test(code[to]!)) to += 1;
      const value = code.slice(i, to);
      tokens.push({
        kind: KEYWORD_UPPER.has(value.toUpperCase()) ? "keyword" : "ident",
        value,
        from: i,
        to,
      });
      i = to;
      continue;
    }

    const pair = code.slice(i, i + 2);
    if (TWO_CHAR_PUNCT.includes(pair)) {
      tokens.push({ kind: "punct", value: pair, from: i, to: i + 2 });
      i += 2;
      continue;
    }

    tokens.push({ kind: "punct", value: char, from: i, to: i + 1 });
    i += 1;
  }

  return tokens;
}

function identName(token: Token): string {
  if (!token.value.startsWith("`")) return token.value;
  return token.value
    .replace(/^`/, "")
    .replace(/`$/, "")
    .replace(/``/g, "`");
}

function isInsideToken(token: Token, cursor: number): boolean {
  if (cursor <= token.from) return false;
  if (cursor < token.to) return true;
  return cursor === token.to && token.unterminated === true;
}

export function patternBindings(
  tokens: Token[],
  upto: number
): Map<string, string | null> {
  const bindings = new Map<string, string | null>();

  for (let i = 0; i + 1 < upto; i += 1) {
    const open = tokens[i]!;
    if (open.kind !== "punct") continue;
    if (open.value !== "(" && open.value !== "[") continue;

    const aliasToken = tokens[i + 1]!;
    if (aliasToken.kind !== "ident") continue;
    const alias = identName(aliasToken);

    let label: string | null = null;
    const colon = i + 2 < upto ? tokens[i + 2] : undefined;
    if (colon && colon.kind === "punct" && colon.value === ":" && i + 3 < upto) {
      const labelToken = tokens[i + 3]!;
      if (labelToken.kind === "ident" || labelToken.kind === "keyword") {
        label = identName(labelToken);
      }
    }

    if (label != null || !bindings.has(alias)) bindings.set(alias, label);
  }

  return bindings;
}

export function nextAliases(
  prefix: string,
  used: ReadonlySet<string>,
  count: number
): string[] {
  const taken = new Set(used);
  const aliases: string[] = [];
  let index = 0;
  while (aliases.length < count) {
    const alias = index === 0 ? prefix : `${prefix}${index}`;
    index += 1;
    if (taken.has(alias)) continue;
    taken.add(alias);
    aliases.push(alias);
  }
  return aliases;
}

function enclosingBracket(tokens: Token[], upto: number): string | null {
  const stack: string[] = [];
  for (let i = 0; i < upto; i += 1) {
    const token = tokens[i]!;
    if (token.kind !== "punct") continue;
    if (token.value === "(" || token.value === "[" || token.value === "{") {
      stack.push(token.value);
    } else if (
      token.value === ")" ||
      token.value === "]" ||
      token.value === "}"
    ) {
      stack.pop();
    }
  }
  return stack.length > 0 ? stack[stack.length - 1]! : null;
}

/** `WITH` is a clause head except in `STARTS WITH` / `ENDS WITH`. */
function isClauseHeadAt(tokens: Token[], index: number): boolean {
  const token = tokens[index]!;
  if (token.kind !== "keyword") return false;
  const upper = token.value.toUpperCase();
  if (!CLAUSE_HEADS.has(upper)) return false;
  if (upper !== "WITH") return true;
  const previous = tokens[index - 1];
  const previousUpper =
    previous && previous.kind === "keyword" ? previous.value.toUpperCase() : "";
  return previousUpper !== "STARTS" && previousUpper !== "ENDS";
}

function clauseAt(tokens: Token[], upto: number): string | null {
  let last: string | null = null;
  for (let i = 0; i < upto; i += 1) {
    if (isClauseHeadAt(tokens, i)) last = tokens[i]!.value.toUpperCase();
  }
  return last;
}

function listedInProjection(tokens: Token[], upto: number): Set<string> {
  let start = -1;
  for (let i = 0; i < upto; i += 1) {
    if (!isClauseHeadAt(tokens, i)) continue;
    const upper = tokens[i]!.value.toUpperCase();
    if (upper === "RETURN" || upper === "WITH") start = i + 1;
  }

  const names = new Set<string>();
  if (start < 0) return names;

  for (let i = start; i < upto; i += 1) {
    const token = tokens[i]!;
    if (token.kind !== "ident") continue;
    const previous = tokens[i - 1];
    if (previous && previous.kind === "punct" && previous.value === ".") {
      continue;
    }
    names.add(identName(token));
  }
  return names;
}

type PropertyRef = { alias: string | null; property: string | null };

/** Reads the `alias.property` (or bare `property`) sitting before an operator. */
function propertyRefBefore(tokens: Token[], operatorIndex: number): PropertyRef {
  const propertyToken = tokens[operatorIndex - 1];
  if (
    !propertyToken ||
    (propertyToken.kind !== "ident" && propertyToken.kind !== "keyword")
  ) {
    return { alias: null, property: null };
  }

  const dot = tokens[operatorIndex - 2];
  if (dot && dot.kind === "punct" && dot.value === ".") {
    const aliasToken = tokens[operatorIndex - 3];
    return {
      alias: aliasToken ? identName(aliasToken) : null,
      property: identName(propertyToken),
    };
  }

  return { alias: null, property: identName(propertyToken) };
}

export type CompletionSlot =
  | "none"
  | "clause"
  | "pattern-start"
  | "pattern-node"
  | "pattern-rel"
  | "pattern-props"
  | "pattern-label"
  | "pattern-dash"
  | "pattern-arrow-out"
  | "pattern-arrow-in"
  | "expression"
  | "member"
  | "property"
  | "operator"
  | "after-starts"
  | "after-is"
  | "value"
  | "continuation"
  | "projection"
  | "projection-tail";

export type SlotInfo = {
  slot: CompletionSlot;
  alias?: string | null;
  property?: string | null;
};

const AUTO_OPEN_SLOTS = new Set<CompletionSlot>([
  "pattern-start",
  "pattern-node",
  "pattern-rel",
  "pattern-props",
  "pattern-label",
  "pattern-dash",
  "pattern-arrow-out",
  "pattern-arrow-in",
  "expression",
  "property",
  "operator",
  "after-starts",
  "after-is",
  "value",
  "projection",
]);

type CursorContext = {
  info: SlotInfo;
  tokens: Token[];
  upto: number;
  bindings: Map<string, string | null>;
  clause: string | null;
  enclosing: string | null;
};

function resolveSlot(
  tokens: Token[],
  upto: number,
  bindings: Map<string, string | null>,
  clause: string | null,
  enclosing: string | null
): SlotInfo {
  const previous = upto > 0 ? tokens[upto - 1]! : null;
  if (!previous) return { slot: "clause" };

  if (previous.kind === "punct") {
    switch (previous.value) {
      case "(":
        return { slot: "pattern-node" };
      case "[":
        return { slot: "pattern-rel" };
      case "{":
        return { slot: "pattern-props" };
      case "->":
        return { slot: "pattern-arrow-out" };
      case "<-":
        return { slot: "pattern-arrow-in" };
      case "-":
        return { slot: "pattern-dash" };
      case ";":
        return { slot: "clause" };
      case ")":
      case "]":
      case "}":
        return { slot: "continuation" };
      case ":": {
        if (enclosing === "{") {
          const key = tokens[upto - 2];
          return { slot: "value", property: key ? identName(key) : null };
        }
        return { slot: "pattern-label" };
      }
      case ".": {
        const aliasToken = tokens[upto - 2];
        return {
          slot: "property",
          alias: aliasToken ? identName(aliasToken) : null,
        };
      }
      case ",": {
        if (clause === "RETURN" || clause === "WITH") {
          return { slot: "projection" };
        }
        if (enclosing === "{") return { slot: "pattern-props" };
        return { slot: "expression" };
      }
      default:
        if (COMPARISON_OPERATORS.has(previous.value)) {
          const ref = propertyRefBefore(tokens, upto - 1);
          return { slot: "value", alias: ref.alias, property: ref.property };
        }
        return { slot: "none" };
    }
  }

  if (previous.kind === "string" || previous.kind === "number") {
    return { slot: "continuation" };
  }

  if (previous.kind === "keyword") {
    const upper = previous.value.toUpperCase();
    if (upper === "MATCH" || upper === "MERGE" || upper === "CREATE") {
      return { slot: "pattern-start" };
    }
    if (upper === "OPTIONAL" || upper === "DETACH") return { slot: "clause" };
    if (
      upper === "WHERE" ||
      upper === "AND" ||
      upper === "OR" ||
      upper === "NOT" ||
      upper === "XOR"
    ) {
      return { slot: "expression" };
    }
    if (
      upper === "RETURN" ||
      upper === "WITH" ||
      upper === "DISTINCT" ||
      upper === "BY"
    ) {
      return { slot: "projection" };
    }
    if (upper === "CONTAINS" || upper === "IN") {
      const ref = propertyRefBefore(tokens, upto - 1);
      return { slot: "value", alias: ref.alias, property: ref.property };
    }
    if (upper === "STARTS" || upper === "ENDS") return { slot: "after-starts" };
    if (upper === "IS") return { slot: "after-is" };
    if (upper === "AS" || upper === "LIMIT" || upper === "SKIP") {
      return { slot: "none" };
    }
    return { slot: "continuation" };
  }

  const name = identName(previous);
  const beforeIdent = tokens[upto - 2];
  if (beforeIdent && beforeIdent.kind === "punct" && beforeIdent.value === ".") {
    const aliasToken = tokens[upto - 3];
    return {
      slot: "operator",
      alias: aliasToken ? identName(aliasToken) : null,
      property: name,
    };
  }
  if (bindings.has(name)) {
    if (clause === "RETURN" || clause === "WITH") {
      return { slot: "projection-tail" };
    }
    return { slot: "member", alias: name };
  }
  return { slot: "continuation" };
}

function cursorContext(code: string, from: number): CursorContext {
  const tokens = tokenize(code);

  for (const token of tokens) {
    if (token.kind !== "string" && token.kind !== "comment") continue;
    if (isInsideToken(token, from)) {
      return {
        info: { slot: "none" },
        tokens,
        upto: 0,
        bindings: new Map(),
        clause: null,
        enclosing: null,
      };
    }
  }

  let upto = tokens.length;
  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i]!.to > from) {
      upto = i;
      break;
    }
  }

  const bindings = patternBindings(tokens, upto);
  const clause = clauseAt(tokens, upto);
  const enclosing = enclosingBracket(tokens, upto);

  return {
    info: resolveSlot(tokens, upto, bindings, clause, enclosing),
    tokens,
    upto,
    bindings,
    clause,
    enclosing,
  };
}

export function slotAtCursor(code: string, from: number): SlotInfo {
  return cursorContext(code, from).info;
}

function uniqueItems(items: CompletionItem[]): CompletionItem[] {
  const seen = new Set<string>();
  const result: CompletionItem[] = [];
  for (const item of items) {
    if (seen.has(item.insert)) continue;
    seen.add(item.insert);
    result.push(item);
  }
  return result;
}

function wordItems(words: string[], kind: CompletionKind): CompletionItem[] {
  return uniqueItems(words.map((word) => ({ label: word, insert: word, kind })));
}

function snippetItems(
  tables: QueryAssistTable[],
  aliases: string[],
  wrap: (alias: string, label: string) => string
): CompletionItem[] {
  return uniqueItems(
    tables.map((table, i) => {
      const insert = wrap(aliases[i]!, quoteIdent(table.tableName));
      return { label: insert, insert, kind: "snippet" as const };
    })
  );
}

function collectNodePatterns(
  graph: QueryAssistGraph,
  used: ReadonlySet<string>
): CompletionItem[] {
  const aliases = nextAliases("n", used, graph.nodeTables.length);
  return snippetItems(
    graph.nodeTables,
    aliases,
    (alias, label) => `${alias}:${label}`
  );
}

function collectRelPatterns(
  graph: QueryAssistGraph,
  used: ReadonlySet<string>
): CompletionItem[] {
  const aliases = nextAliases("r", used, graph.edgeTables.length);
  return snippetItems(
    graph.edgeTables,
    aliases,
    (alias, label) => `${alias}:${label}`
  );
}

function collectDashRels(
  graph: QueryAssistGraph,
  used: ReadonlySet<string>
): CompletionItem[] {
  const aliases = nextAliases("r", used, graph.edgeTables.length);
  return snippetItems(
    graph.edgeTables,
    aliases,
    (alias, label) => `[${alias}:${label}]->`
  );
}

function collectIncomingRels(
  graph: QueryAssistGraph,
  used: ReadonlySet<string>
): CompletionItem[] {
  const aliases = nextAliases("r", used, graph.edgeTables.length);
  return snippetItems(
    graph.edgeTables,
    aliases,
    (alias, label) => `[${alias}:${label}]-`
  );
}

function collectArrowOutNodes(
  graph: QueryAssistGraph,
  used: ReadonlySet<string>
): CompletionItem[] {
  const aliases = nextAliases("n", used, graph.nodeTables.length);
  return snippetItems(
    graph.nodeTables,
    aliases,
    (alias, label) => `(${alias}:${label})`
  );
}

function tablesFor(
  graph: QueryAssistGraph,
  enclosing: string | null
): QueryAssistTable[] {
  if (enclosing === "(") return graph.nodeTables;
  if (enclosing === "[") return graph.edgeTables;
  return [...graph.nodeTables, ...graph.edgeTables];
}

function collectLabels(
  graph: QueryAssistGraph,
  enclosing: string | null
): CompletionItem[] {
  return uniqueItems(
    tablesFor(graph, enclosing).map((table) => ({
      label: table.tableName,
      insert: quoteIdent(table.tableName),
      kind: "label" as const,
    }))
  );
}

function findTable(
  graph: QueryAssistGraph,
  tableName: string | null
): QueryAssistTable | null {
  if (!tableName) return null;
  return (
    [...graph.nodeTables, ...graph.edgeTables].find(
      (table) => table.tableName === tableName
    ) ?? null
  );
}

function propertyNames(
  graph: QueryAssistGraph,
  tableName: string | null
): string[] {
  const table = findTable(graph, tableName);
  const tables = table ? [table] : [...graph.nodeTables, ...graph.edgeTables];
  const names: string[] = [];
  for (const entry of tables) {
    if (entry.primaryKey) names.push(entry.primaryKey);
    names.push(...Object.keys(entry.properties ?? {}));
  }
  return [...new Set(names)];
}

function collectProperties(
  graph: QueryAssistGraph,
  tableName: string | null
): CompletionItem[] {
  return uniqueItems(
    propertyNames(graph, tableName).map((name) => ({
      label: name,
      insert: quoteIdent(name),
      kind: "property" as const,
    }))
  );
}

function collectBraceProperties(graph: QueryAssistGraph): CompletionItem[] {
  return uniqueItems(
    propertyNames(graph, null).map((name) => {
      const insert = `${quoteIdent(name)}:`;
      return { label: insert, insert, kind: "snippet" as const };
    })
  );
}

function collectPkValues(graph: QueryAssistGraph): CompletionItem[] {
  const items: CompletionItem[] = [];
  const seen = new Set<string>();
  for (const node of graph.nodes) {
    if (items.length >= PK_VALUE_CAP) break;
    const insert = formatCypherLiteral(node._primaryKeyValue);
    if (seen.has(insert)) continue;
    seen.add(insert);
    items.push({ label: String(node._primaryKeyValue), insert, kind: "value" });
  }
  return items;
}

function collectValues(
  graph: QueryAssistGraph,
  tableName: string | null,
  property: string | null
): CompletionItem[] {
  if (!property) return collectPkValues(graph);

  const items: CompletionItem[] = [];
  const seen = new Set<string>();

  const push = (value: unknown) => {
    if (value === undefined) return;
    if (items.length >= PK_VALUE_CAP) return;
    const insert = formatCypherLiteral(value);
    if (seen.has(insert)) return;
    seen.add(insert);
    items.push({ label: String(value), insert, kind: "value" });
  };

  for (const node of graph.nodes) {
    if (tableName && node.tableName !== tableName) continue;
    if (node._primaryKey === property) push(node._primaryKeyValue);
    else push(node.attributes?.[property]);
  }

  for (const edge of graph.edges ?? []) {
    if (tableName && edge.tableName !== tableName) continue;
    push(edge.attributes?.[property]);
  }

  return items;
}

function collectAliasItems(aliases: Iterable<string>): CompletionItem[] {
  return uniqueItems(
    [...aliases].map((alias) => ({
      label: alias,
      insert: alias,
      kind: "variable" as const,
    }))
  );
}

function continuationItems(clause: string | null): CompletionItem[] {
  const words = clause ? CONTINUATIONS_BY_CLAUSE[clause] : undefined;
  return wordItems(words ?? DEFAULT_CONTINUATIONS, "keyword");
}

function projectionItems(
  graph: QueryAssistGraph,
  context: CursorContext
): CompletionItem[] {
  const listed = listedInProjection(context.tokens, context.upto);
  const aliases = [...context.bindings.keys()].filter(
    (alias) => !listed.has(alias)
  );

  const items = collectAliasItems(aliases);
  if (listed.size === 0) {
    items.push({ label: "DISTINCT", insert: "DISTINCT", kind: "keyword" });
  }

  for (const alias of aliases) {
    const table = context.bindings.get(alias) ?? null;
    for (const property of propertyNames(graph, table)) {
      const insert = `${alias}.${quoteIdent(property)}`;
      items.push({ label: insert, insert, kind: "property" });
    }
  }

  return uniqueItems(items);
}

function itemsForContext(
  context: CursorContext,
  graph: QueryAssistGraph
): CompletionItem[] {
  const { info, bindings, clause, enclosing } = context;
  const used = new Set(bindings.keys());
  const aliasTable = info.alias ? (bindings.get(info.alias) ?? null) : null;

  switch (info.slot) {
    case "none":
      return [];
    case "clause":
      return wordItems(CLAUSE_HEAD_LIST, "keyword");
    case "pattern-start":
      return collectArrowOutNodes(graph, used);
    case "pattern-node":
      return collectNodePatterns(graph, used);
    case "pattern-rel":
      return collectRelPatterns(graph, used);
    case "pattern-props":
      return collectBraceProperties(graph);
    case "pattern-label":
      return collectLabels(graph, enclosing);
    case "pattern-dash":
      return collectDashRels(graph, used);
    case "pattern-arrow-out":
      return collectArrowOutNodes(graph, used);
    case "pattern-arrow-in":
      return collectIncomingRels(graph, used);
    case "expression":
      return collectAliasItems(used);
    case "member":
      return [
        { label: ".", insert: ".", kind: "operator" },
        ...continuationItems(clause),
      ];
    case "property":
      return collectProperties(graph, aliasTable);
    case "operator":
      return wordItems(OPERATOR_SUGGESTIONS, "operator");
    case "after-starts":
      return wordItems(["WITH"], "operator");
    case "after-is":
      return wordItems(["NULL", "NOT NULL"], "operator");
    case "value":
      return collectValues(graph, aliasTable, info.property ?? null);
    case "continuation":
      return continuationItems(clause);
    case "projection":
      return projectionItems(graph, context);
    case "projection-tail":
      return wordItems(PROJECTION_TAIL, "keyword");
    default:
      return [];
  }
}

export function completionsAtCursor(
  code: string,
  cursor: number,
  graph: QueryAssistGraph
): CompletionsResult {
  const { from, to, prefix } = tokenRangeAtCursor(code, cursor);
  const context = cursorContext(code, from);

  let items = itemsForContext(context, graph);

  const query = prefix.toLowerCase();
  if (query) {
    items = items.filter(
      (item) =>
        item.label.toLowerCase().startsWith(query) ||
        item.insert.toLowerCase().startsWith(query)
    );
  }

  return { from, to, items };
}

export function applyCompletion(
  code: string,
  from: number,
  to: number,
  insert: string
): { code: string; cursor: number } {
  const next = `${code.slice(0, from)}${insert}${code.slice(to)}`;
  return { code: next, cursor: from + insert.length };
}

export function shouldOpenCompletions(
  code: string,
  cursor: number,
  items: CompletionItem[]
): boolean {
  if (items.length === 0) return false;
  if (code.trim() === "") return false;
  const { from, prefix } = tokenRangeAtCursor(code, cursor);
  const { info } = cursorContext(code, from);
  if (info.slot === "none") return false;
  if (prefix.length > 0) return true;
  return AUTO_OPEN_SLOTS.has(info.slot);
}
