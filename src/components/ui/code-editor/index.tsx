import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { Compartment, EditorState, Prec } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";

import { Separator } from "../separator";
import { Button } from "../button";

import { cypherLanguageSupport } from "./cypher-stream";

import {
  completionsAtCursor,
  placeholderQuery,
  shouldOpenCompletions,
  starterChips,
  type CompletionItem,
  type CompletionsResult,
  type QueryAssistGraph,
} from "~/features/visualizer/queries/query-assist";
import { cn } from "~/lib/utils";

const EMPTY_GRAPH: QueryAssistGraph = {
  nodeTables: [],
  edgeTables: [],
  nodes: [],
};

const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "transparent",
    fontSize: "inherit",
    color: "var(--color-typography-primary)",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
  ".cm-scroller::-webkit-scrollbar": {
    display: "none",
  },
  ".cm-content": {
    paddingTop: "0.25rem",
    paddingBottom: "0.25rem",
    caretColor: "var(--color-typography-primary)",
  },
  ".cm-placeholder": {
    color: "var(--color-typography-tertiary)",
  },
});

export default function CodeEditor({
  code,
  setCode,
  className,
  graph = EMPTY_GRAPH,
}: {
  code: string;
  setCode: (s: string) => void;
  className?: string;
  graph?: QueryAssistGraph;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const placeholderCompartment = useRef(new Compartment()).current;
  const setCodeRef = useRef(setCode);
  const completionsOpenRef = useRef(false);
  const selectedIndexRef = useRef(0);
  const visibleItemsRef = useRef<CompletionItem[]>([]);
  const completionsRef = useRef<CompletionsResult>({
    from: 0,
    to: 0,
    items: [],
  });
  const insertCompletionRef = useRef<(index: number) => void>(() => undefined);

  const [cursor, setCursor] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [caretOffset, setCaretOffset] = useState({ top: 0, left: 0 });

  const lineCount = useMemo(
    () => Math.max(code.split(/\r?\n/).length, 1),
    [code]
  );
  const isEmpty = code.trim() === "";
  const chips = useMemo(() => starterChips(graph), [graph]);
  const placeholderText = useMemo(() => placeholderQuery(graph), [graph]);

  const completions = useMemo(
    () => completionsAtCursor(code, cursor, graph),
    [code, cursor, graph]
  );
  const visibleItems = completions.items.slice(0, 8);
  const completionsOpen =
    !dismissed && shouldOpenCompletions(code, cursor, completions.items);

  setCodeRef.current = setCode;
  completionsOpenRef.current = completionsOpen;
  selectedIndexRef.current = selectedIndex;
  visibleItemsRef.current = visibleItems;
  completionsRef.current = completions;

  const insertCompletion = useCallback((index: number) => {
    const view = viewRef.current;
    const item = visibleItemsRef.current[index];
    const range = completionsRef.current;
    if (!view || !item) return;
    view.dispatch({
      changes: { from: range.from, to: range.to, insert: item.insert },
      selection: { anchor: range.from + item.insert.length },
    });
    setCursor(range.from + item.insert.length);
  }, []);

  insertCompletionRef.current = insertCompletion;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: code,
        extensions: [
          history(),
          keymap.of(historyKeymap),
          keymap.of(defaultKeymap),
          Prec.highest(
            keymap.of([
              {
                key: "Tab",
                run: () => {
                  if (
                    !completionsOpenRef.current ||
                    visibleItemsRef.current.length === 0
                  ) {
                    return false;
                  }
                  insertCompletionRef.current(selectedIndexRef.current);
                  return true;
                },
              },
              {
                key: "Enter",
                run: () => {
                  if (
                    !completionsOpenRef.current ||
                    visibleItemsRef.current.length === 0
                  ) {
                    return false;
                  }
                  insertCompletionRef.current(selectedIndexRef.current);
                  return true;
                },
              },
              {
                key: "ArrowDown",
                run: () => {
                  if (
                    !completionsOpenRef.current ||
                    visibleItemsRef.current.length === 0
                  ) {
                    return false;
                  }
                  setSelectedIndex(
                    (index) => (index + 1) % visibleItemsRef.current.length
                  );
                  return true;
                },
              },
              {
                key: "ArrowUp",
                run: () => {
                  if (
                    !completionsOpenRef.current ||
                    visibleItemsRef.current.length === 0
                  ) {
                    return false;
                  }
                  setSelectedIndex(
                    (index) =>
                      (index - 1 + visibleItemsRef.current.length) %
                      visibleItemsRef.current.length
                  );
                  return true;
                },
              },
              {
                key: "Escape",
                run: () => {
                  if (!completionsOpenRef.current) return false;
                  setDismissed(true);
                  return true;
                },
              },
            ])
          ),
          placeholderCompartment.of(placeholder(placeholderText)),
          ...cypherLanguageSupport,
          editorTheme,
          EditorView.contentAttributes.of({ spellcheck: "false" }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              setCodeRef.current(update.state.doc.toString());
            }
            if (update.docChanged || update.selectionSet) {
              setCursor(update.state.selection.main.head);
            }
            if (update.docChanged && lineNumbersRef.current) {
              lineNumbersRef.current.scrollTop =
                update.view.scrollDOM.scrollTop;
            }
          }),
        ],
      }),
    });

    viewRef.current = view;
    const syncGutterScroll = () => {
      if (lineNumbersRef.current) {
        lineNumbersRef.current.scrollTop = view.scrollDOM.scrollTop;
      }
    };
    view.scrollDOM.addEventListener("scroll", syncGutterScroll);
    return () => {
      view.scrollDOM.removeEventListener("scroll", syncGutterScroll);
      view.destroy();
      viewRef.current = null;
    };
    // Mount once; code/placeholder sync via later effects.
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (code !== current) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: code },
      });
    }
  }, [code]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: placeholderCompartment.reconfigure(placeholder(placeholderText)),
    });
  }, [placeholderCompartment, placeholderText]);

  useEffect(() => {
    setSelectedIndex(0);
    setDismissed(false);
  }, [completions.from, completions.to, completions.items.length]);

  useEffect(() => {
    const view = viewRef.current;
    const wrapper = wrapperRef.current;
    if (!view || !wrapper || !completionsOpen) return;
    const coords = view.coordsAtPos(completions.from);
    if (!coords) return;
    const wrap = wrapper.getBoundingClientRect();
    setCaretOffset({
      top: coords.bottom - wrap.top,
      left: coords.left - wrap.left,
    });
  }, [completions.from, completionsOpen, code, cursor]);

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "relative flex h-full border border-border rounded-md",
        className
      )}
    >
      {/* Line Numbers */}
      <div
        ref={lineNumbersRef}
        className={cn(
          "absolute top-0 left-0 w-14 h-full",
          "px-2 py-1 overflow-hidden pointer-events-none select-none",
          "font-mono text-typography-tertiary whitespace-pre"
        )}
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} className="text-right">
            {i + 1}
          </div>
        ))}
      </div>

      <Separator
        orientation="vertical"
        className="absolute left-14 top-0 h-full opacity-50"
      />

      <div
        ref={hostRef}
        className="ml-16 mr-1 h-full min-h-0 min-w-0 flex-1 overflow-hidden font-mono"
      />

      {isEmpty && chips.length > 0 && (
        <div className="pointer-events-none absolute top-8 right-2 left-16 flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <Button
              key={chip.id}
              type="button"
              size="sm"
              variant="outline"
              title={chip.query}
              className="pointer-events-auto max-w-full truncate"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setCode(chip.query)}
            >
              {chip.label}
            </Button>
          ))}
        </div>
      )}

      {completionsOpen && visibleItems.length > 0 && (
        <ul
          className="bg-page absolute z-10 max-h-56 min-w-40 overflow-y-auto rounded-md border border-border py-1 text-sm shadow-sm"
          style={{
            top: Math.max(caretOffset.top, 4),
            left: Math.max(caretOffset.left, 64),
          }}
        >
          {visibleItems.map((item, index) => (
            <li key={`${item.kind}-${item.insert}`}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center justify-between gap-3 px-2 py-1.5 text-left",
                  index === selectedIndex
                    ? "bg-neutral-low"
                    : "hover:bg-neutral-low/60"
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insertCompletion(index)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <span className="font-mono truncate">{item.label}</span>
                <span className="text-typography-tertiary shrink-0 text-xs">
                  {item.kind}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
