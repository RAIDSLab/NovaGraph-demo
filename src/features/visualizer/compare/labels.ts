/**
 * Trims the trailing table qualifier off an igraph display label
 * (`"key (Table)"` becomes `"key"`) for use in cramped summaries. Splitting on
 * the last `" ("` keeps keys that themselves contain spaces intact.
 */
export function shortNodeLabel(label: string): string {
  const separator = label.lastIndexOf(" (");
  return separator > 0 ? label.slice(0, separator) : label;
}
