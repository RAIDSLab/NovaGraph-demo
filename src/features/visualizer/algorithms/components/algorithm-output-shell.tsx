import type { ReactNode } from "react";

export function AlgorithmOutputShell({
  header,
  body,
  footer,
}: {
  header: ReactNode;
  body: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="shrink-0 space-y-4">{header}</div>
      <div className="flex min-h-0 flex-1 flex-col">{body}</div>
      {footer ? (
        <div className="shrink-0 max-h-28 overflow-y-auto border-t border-t-border pt-3">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
