import { useEffect, useState } from "react";

import Logo from "../logo";

import { useLoading } from "./use-loading";

import { cn } from "~/lib/utils";

export function Loading({
  className,
  overlayClassName,
}: {
  className?: string;
  overlayClassName?: string;
}) {
  const { isLoading, loadingMessage } = useLoading();
  const [barOffset, setBarOffset] = useState(-40);
  const [dotCount, setDotCount] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      setBarOffset(-40);
      setDotCount(0);
      return;
    }

    const interval = window.setInterval(() => {
      setBarOffset((prev) => (prev >= 140 ? -40 : prev + 4));
    }, 40);

    return () => window.clearInterval(interval);
  }, [isLoading]);

  useEffect(() => {
    if (!isLoading) return;
    const interval = window.setInterval(() => {
      setDotCount((prev) => (prev + 1) % 4);
    }, 300);
    return () => window.clearInterval(interval);
  }, [isLoading]);

  if (!isLoading) return null;
  const message = loadingMessage ?? "Loading";
  const animatedDots = ".".repeat(dotCount);

  return (
    <div
      className={cn(
        "fixed inset-0 z-100 flex items-center justify-center",
        overlayClassName
      )}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Loading content */}
      <div
        className={cn(
          "relative z-10 flex min-w-72 flex-col items-center space-y-3 rounded-lg border border-white/10 bg-black/40 px-6 py-5",
          className
        )}
      >
        <Logo
          alt="Loading"
          className="size-8 animate-spin text-primary"
          aria-hidden="true"
        />

        {/* Loading message */}
        {loadingMessage && (
          <p className="text-center text-sm text-white">
            {message}
            <span className="inline-block w-6 text-left">{animatedDots}</span>
          </p>
        )}

        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="absolute inset-y-0 w-2/5 rounded-full bg-primary"
            style={{ transform: `translateX(${barOffset}%)` }}
          />
        </div>
      </div>
    </div>
  );
}

export * from "./use-loading";
