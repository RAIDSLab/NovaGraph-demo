import { ChevronDown, ChevronUp, Timer, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  BENCHMARK_TIMING_EVENT,
  formatBenchmarkMs,
  type BenchmarkTimingLogEntry,
} from "~/igraph/benchmark-timing";
import { cn } from "~/lib/utils";

const MAX_HISTORY = 12;

function primaryMetricsForEntry(entry: BenchmarkTimingLogEntry): {
  label: string;
  value: number | null;
}[] {
  const { timing, caseId } = entry;
  if (caseId === "BC00" || timing.T0_import_ms != null) {
    return [{ label: "T0 Import", value: timing.T0_import_ms }];
  }
  return [
    { label: "T4 Invoke", value: timing.T4_system_invoke_ms },
    { label: "T5 UI E2E", value: timing.T5_ui_e2e_ms },
  ];
}

function MetricRow({
  label,
  value,
  large,
}: {
  label: string;
  value: number | null;
  large?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={cn("text-white/80 shrink-0", large ? "text-sm" : "text-xs")}>
        {label}
      </span>
      <span
        className={cn(
          "font-mono tabular-nums text-emerald-300 font-semibold text-right",
          large ? "text-xl sm:text-2xl" : "text-sm"
        )}
      >
        {formatBenchmarkMs(value)}
      </span>
    </div>
  );
}

function EntryBlock({
  entry,
  large,
}: {
  entry: BenchmarkTimingLogEntry;
  large?: boolean;
}) {
  const metrics = primaryMetricsForEntry(entry);
  const title = entry.caseId
    ? `${entry.caseId} · ${entry.operation}`
    : entry.operation;

  return (
    <div className="space-y-1.5">
      <p
        className={cn(
          "font-medium text-white leading-snug break-words",
          large ? "text-sm" : "text-xs"
        )}
      >
        {title}
      </p>
      {metrics.map((m) => (
        <MetricRow key={m.label} label={m.label} value={m.value} large={large} />
      ))}
    </div>
  );
}

/** On-screen T0 / T4 / T5 for manual recording on phone or iPad (no devtools). */
export default function BenchmarkTimingOverlay() {
  const [entries, setEntries] = useState<BenchmarkTimingLogEntry[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const onTiming = useCallback((event: Event) => {
    const detail = (event as CustomEvent<BenchmarkTimingLogEntry>).detail;
    if (!detail?.timing) return;
    setDismissed(false);
    setEntries((prev) => [detail, ...prev].slice(0, MAX_HISTORY));
  }, []);

  useEffect(() => {
    window.addEventListener(BENCHMARK_TIMING_EVENT, onTiming);
    return () => window.removeEventListener(BENCHMARK_TIMING_EVENT, onTiming);
  }, [onTiming]);

  const latest = entries[0] ?? null;
  const visible = !dismissed && latest != null;

  const history = useMemo(() => entries.slice(1), [entries]);

  if (!visible) return null;

  return (
    <div
      className="fixed z-[200] left-3 right-3 sm:left-4 sm:right-auto sm:max-w-[min(100vw-2rem,22rem)] top-[4.5rem] pointer-events-auto"
      role="status"
      aria-live="polite"
      aria-label="Benchmark timing"
    >
      <div className="rounded-lg border border-white/15 bg-neutral-950/92 text-white shadow-lg backdrop-blur-sm p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 text-xs text-white/70 uppercase tracking-wide">
            <Timer className="size-3.5 shrink-0" aria-hidden />
            Benchmark timing
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {entries.length > 1 && (
              <button
                type="button"
                className="p-2 rounded-md hover:bg-white/10 touch-manipulation"
                aria-expanded={expanded}
                aria-label={expanded ? "Collapse history" : "Show history"}
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? (
                  <ChevronUp className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
              </button>
            )}
            <button
              type="button"
              className="p-2 rounded-md hover:bg-white/10 touch-manipulation"
              aria-label="Hide timing panel"
              onClick={() => setDismissed(true)}
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <EntryBlock entry={latest} large />

        {expanded && history.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/10 space-y-3 max-h-48 overflow-y-auto">
            {history.map((entry) => (
              <EntryBlock key={entry.ts} entry={entry} />
            ))}
          </div>
        )}

        {!expanded && entries.length > 1 && (
          <p className="mt-2 text-[10px] text-white/50">
            +{entries.length - 1} earlier — expand for history
          </p>
        )}
      </div>
    </div>
  );
}
