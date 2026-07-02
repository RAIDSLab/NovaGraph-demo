import type { ReactNode } from "react";

import { WhatThisMeansSection } from "./what-this-means-section";

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
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="shrink-0 space-y-2">{header}</div>
      <div className="flex min-h-0 flex-1 flex-col">{body}</div>
      {footer ? <WhatThisMeansSection>{footer}</WhatThisMeansSection> : null}
    </div>
  );
}
