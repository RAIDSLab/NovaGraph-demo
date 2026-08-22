import type { InputType } from "../inputs";

const MAX_VALUE_LENGTH = 24;

function formatValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "boolean") return value ? "on" : "off";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.length > MAX_VALUE_LENGTH
      ? `${trimmed.slice(0, MAX_VALUE_LENGTH)}...`
      : trimmed;
  }
  if (Array.isArray(value)) {
    const parts = value
      .map(formatValue)
      .filter((part): part is string => part != null);
    return parts.length === 0 ? null : parts.join("/");
  }
  return null;
}

/**
 * Short "Name=value" summary of the inputs a run was invoked with, so two runs
 * of the same algorithm stay distinguishable in the baseline picker. File
 * inputs are skipped because their contents are far too large to label with.
 */
export function buildParamLabel(inputs: InputType[], args: unknown[]): string {
  const parts: string[] = [];
  inputs.forEach((input, index) => {
    if (input.type === "file") return;
    const formatted = formatValue(args[index]);
    if (formatted == null) return;
    parts.push(`${input.displayName}=${formatted}`);
  });
  return parts.join(", ");
}

/** `Louvain (Resolution=1.5)`, or just the title when there are no inputs. */
export function runDisplayTitle(title: string, paramLabel: string): string {
  return paramLabel ? `${title} (${paramLabel})` : title;
}

/**
 * Compact label for the baseline picker trigger. When the baseline is another
 * run of the same algorithm, the title is redundant — show only the params.
 */
export function baselineButtonLabel(
  runTitle: string,
  paramLabel: string,
  currentRunTitle?: string | null
): string {
  if (paramLabel && currentRunTitle && runTitle === currentRunTitle) {
    return paramLabel;
  }
  return runDisplayTitle(runTitle, paramLabel);
}
