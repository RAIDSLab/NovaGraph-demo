import { Search, X } from "lucide-react";

import { Input } from "~/components/form/input";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export function ResultsSearchInput({
  value,
  onChange,
  placeholder = "Search nodes...",
  resultCount,
  totalCount,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  resultCount?: number;
  totalCount?: number;
  className?: string;
}) {
  const showCount =
    value.trim().length > 0 &&
    resultCount !== undefined &&
    totalCount !== undefined;

  return (
    <div className={cn("flex shrink-0 items-center gap-2", className)}>
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-typography-tertiary" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-8 pl-8 pr-8 text-sm"
          aria-label={placeholder}
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-1/2 right-0.5 size-7 -translate-y-1/2"
            onClick={() => onChange("")}
            title="Clear search"
          >
            <X className="size-3.5" />
          </Button>
        )}
      </div>
      {showCount && (
        <span className="shrink-0 text-xs text-typography-secondary tabular-nums">
          {resultCount}/{totalCount}
        </span>
      )}
    </div>
  );
}
