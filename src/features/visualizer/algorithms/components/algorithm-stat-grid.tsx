import type { ReactNode } from "react";

export function AlgorithmStatGrid({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-1.5 text-sm">{children}</div>;
}

export function AlgorithmStat({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-typography-secondary">{label}</span>
      <span className="min-w-0 text-right font-medium text-typography-primary break-words">
        {value}
      </span>
    </div>
  );
}
