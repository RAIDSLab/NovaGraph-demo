import {
  HighlightStyle,
  StreamLanguage,
  syntaxHighlighting,
} from "@codemirror/language";
import { tags } from "@lezer/highlight";

import { QUERY_KEYWORDS } from "~/features/visualizer/queries/query-assist";

const EXTRA_KEYWORDS = ["NODE", "REL", "TABLE", "PRIMARY", "KEY"] as const;

const KEYWORD_SET = new Set<string>([
  ...QUERY_KEYWORDS.map((keyword) => keyword.toLowerCase()),
  ...EXTRA_KEYWORDS.map((keyword) => keyword.toLowerCase()),
]);

type CypherStreamState = {
  inBlockComment: boolean;
};

export const cypherStreamLanguage = StreamLanguage.define<CypherStreamState>({
  startState: () => ({ inBlockComment: false }),
  token(stream, state) {
    if (state.inBlockComment) {
      if (stream.match(/.*?\*\//)) {
        state.inBlockComment = false;
      } else {
        stream.skipToEnd();
      }
      return "comment";
    }

    if (stream.match("/*")) {
      state.inBlockComment = true;
      return "comment";
    }

    if (stream.match("//")) {
      stream.skipToEnd();
      return "comment";
    }

    if (
      stream.match(/^"(?:\\.|[^"\\])*"/) ||
      stream.match(/^'(?:\\.|[^'\\])*'/)
    ) {
      return "string";
    }

    if (stream.match(/^`(?:``|[^`])*`/)) {
      return "variableName";
    }

    if (stream.match(/^-?\d+(?:\.\d+)?/)) {
      return "number";
    }

    if (stream.match(/^[A-Za-z_][A-Za-z0-9_]*/)) {
      const word = stream.current();
      if (KEYWORD_SET.has(word.toLowerCase())) return "keyword";
      return null;
    }

    stream.next();
    return null;
  },
});

export const cypherHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--color-primary)" },
  { tag: tags.string, color: "var(--color-typography-primary)" },
  { tag: tags.number, color: "var(--color-typography-primary)" },
  { tag: tags.comment, color: "var(--color-typography-tertiary)" },
  { tag: tags.variableName, color: "var(--color-typography-primary)" },
]);

export const cypherLanguageSupport = [
  cypherStreamLanguage,
  syntaxHighlighting(cypherHighlightStyle),
];
