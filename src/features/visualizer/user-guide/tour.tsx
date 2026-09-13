import { useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  resolveTourPanelLayout,
  TOUR_STEPS,
  type TourPlacement,
  type TourStep,
} from "./content";
import { hasSeenTour, useVisualizerUi } from "./ui-context";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { useIsMobile } from "~/hooks/use-mobile";
import { cn } from "~/lib/utils";

const MOBILE_BREAKPOINT = 1024;
const HIGHLIGHT_PADDING = 8;
const TOOLTIP_WIDTH = 320;
const TOOLTIP_GAP = 12;
const VIEW_MARGIN = 16;
const MORPH_MS = 520;
const FADE_MS = 280;
const FOLLOW_MS = 800;
const SETTLE_PX = 1;
const SETTLE_FRAMES = 2;

type Hole = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type TooltipPos = { top: number; left: number };

const easeOutQuint = (t: number) => {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return 1 - (1 - t) ** 5;
};

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

const lerpHole = (from: Hole, to: Hole, t: number): Hole => ({
  top: lerp(from.top, to.top, t),
  left: lerp(from.left, to.left, t),
  width: lerp(from.width, to.width, t),
  height: lerp(from.height, to.height, t),
});

const holeDelta = (a: Hole, b: Hole) =>
  Math.max(
    Math.abs(a.top - b.top),
    Math.abs(a.left - b.left),
    Math.abs(a.width - b.width),
    Math.abs(a.height - b.height)
  );

const measureSelector = (selector: string): Hole | null => {
  const el = document.querySelector(selector);
  if (!(el instanceof HTMLElement)) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width < 4 && rect.height < 4) return null;
  return {
    top: Math.max(0, rect.top - HIGHLIGHT_PADDING),
    left: Math.max(0, rect.left - HIGHLIGHT_PADDING),
    width: Math.min(
      rect.width + HIGHLIGHT_PADDING * 2,
      window.innerWidth - Math.max(0, rect.left - HIGHLIGHT_PADDING)
    ),
    height: Math.min(
      rect.height + HIGHLIGHT_PADDING * 2,
      window.innerHeight - Math.max(0, rect.top - HIGHLIGHT_PADDING)
    ),
  };
};

const placeTooltip = (
  hole: Hole,
  placement: TourPlacement,
  tooltipHeight: number
): TooltipPos => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const height = Math.max(tooltipHeight, 1);
  let top = hole.top;
  let left = hole.left;

  if (placement === "right") {
    left = hole.left + hole.width + TOOLTIP_GAP;
    top = hole.top;
  } else if (placement === "left") {
    left = hole.left - TOOLTIP_WIDTH - TOOLTIP_GAP;
    top = hole.top;
  } else {
    top = hole.top + hole.height + TOOLTIP_GAP;
    left = hole.left;
    if (top + height > vh - VIEW_MARGIN) {
      top = hole.top - height - TOOLTIP_GAP;
    }
  }

  left = Math.min(Math.max(VIEW_MARGIN, left), vw - TOOLTIP_WIDTH - VIEW_MARGIN);
  top = Math.min(Math.max(VIEW_MARGIN, top), vh - height - VIEW_MARGIN);
  return { top, left };
};

export default function ProductTour() {
  const isMobile = useIsMobile();
  const {
    tourActive,
    tourStepIndex,
    setTourStepIndex,
    startTour,
    stopTour,
    guideOpen,
    setAlgorithmSidebarOpen,
    setSettingsSidebarOpen,
    setOutputDrawerOpen,
  } = useVisualizerUi();
  const [hole, setHole] = useState<Hole | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [ready, setReady] = useState(false);
  const [cardHeight, setCardHeight] = useState(200);
  const holeRef = useRef<Hole | null>(null);
  const animatingRef = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const guideOpenRef = useRef(guideOpen);
  guideOpenRef.current = guideOpen;

  useEffect(() => {
    if (window.innerWidth < MOBILE_BREAKPOINT) return;
    if (hasSeenTour()) return;

    const timeout = window.setTimeout(() => {
      if (window.innerWidth < MOBILE_BREAKPOINT) return;
      if (hasSeenTour()) return;
      if (guideOpenRef.current) return;
      startTour();
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [startTour]);

  useEffect(() => {
    if (isMobile && tourActive) stopTour(false);
  }, [isMobile, tourActive, stopTour]);

  useEffect(() => {
    if (tourActive && !isMobile) {
      setOverlayVisible(true);
      setExiting(false);
      return;
    }

    if (!overlayVisible) return;

    setExiting(true);
    setReady(false);
    const timeout = window.setTimeout(() => {
      setOverlayVisible(false);
      setExiting(false);
      setHole(null);
      holeRef.current = null;
    }, FADE_MS);

    return () => window.clearTimeout(timeout);
  }, [tourActive, isMobile, overlayVisible]);

  const step: TourStep | undefined = TOUR_STEPS[tourStepIndex];

  useEffect(() => {
    if (!tourActive || !step) return;

    const layout = resolveTourPanelLayout(step.prepare);
    setAlgorithmSidebarOpen(layout.algorithms);
    setSettingsSidebarOpen(layout.settings);
    setOutputDrawerOpen(layout.output);

    const from = holeRef.current;
    const startedAt = performance.now();
    let raf = 0;
    let settledFrames = 0;
    let lastMeasured: Hole | null = null;
    let cancelled = false;
    animatingRef.current = true;

    const tick = (now: number) => {
      if (cancelled) return;
      const measured = measureSelector(step.selector);
      const t = easeOutQuint(Math.min(1, (now - startedAt) / MORPH_MS));

      if (measured) {
        if (lastMeasured && holeDelta(measured, lastMeasured) < SETTLE_PX) {
          settledFrames += 1;
        } else {
          settledFrames = 0;
        }
        lastMeasured = measured;

        const next = from ? lerpHole(from, measured, t) : measured;
        holeRef.current = next;
        setHole(next);
        setReady(true);

        const settled = t >= 1 && settledFrames >= SETTLE_FRAMES;
        const timedOut = now - startedAt > FOLLOW_MS;
        if (settled || timedOut) {
          holeRef.current = measured;
          setHole(measured);
          animatingRef.current = false;
          return;
        }

        raf = requestAnimationFrame(tick);
        return;
      }

      if (now - startedAt < FOLLOW_MS) {
        raf = requestAnimationFrame(tick);
        return;
      }

      animatingRef.current = false;
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      animatingRef.current = false;
      cancelAnimationFrame(raf);
    };
  }, [
    tourActive,
    tourStepIndex,
    step,
    setAlgorithmSidebarOpen,
    setSettingsSidebarOpen,
    setOutputDrawerOpen,
  ]);

  useEffect(() => {
    if (!tourActive || !step) return;

    const update = () => {
      if (animatingRef.current) return;
      const measured = measureSelector(step.selector);
      if (!measured) return;
      holeRef.current = measured;
      setHole(measured);
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [tourActive, tourStepIndex, step]);

  useEffect(() => {
    if (!tourActive) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        stopTour(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tourActive, stopTour]);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const next = el.offsetHeight;
    if (next > 0 && next !== cardHeight) setCardHeight(next);
  }, [step, hole, tourStepIndex, cardHeight]);

  if (!overlayVisible || isMobile || !step) return null;

  const isLast = tourStepIndex === TOUR_STEPS.length - 1;
  const tooltip = hole ? placeTooltip(hole, step.placement, cardHeight) : null;
  const shown = ready && !exiting;

  return (
    <div
      className={cn(
        "fixed inset-0 z-40 overflow-hidden transition-opacity",
        shown ? "opacity-100" : "opacity-0"
      )}
      style={{
        transitionDuration: `${FADE_MS}ms`,
        transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
      }}
      role="dialog"
      aria-label="Product tour"
      aria-hidden={!shown}
    >
      {hole ? (
        <div
          className="pointer-events-none absolute top-0 left-0 rounded-md"
          style={{
            width: hole.width,
            height: hole.height,
            transform: `translate3d(${hole.left}px, ${hole.top}px, 0)`,
            boxShadow:
              "0 0 0 2px var(--color-primary), 0 0 0 9999px rgb(0 0 0 / 0.5)",
          }}
        />
      ) : null}

      {hole && tooltip ? (
        <Card
          ref={cardRef}
          className="absolute z-50 top-0 left-0 shadow-lg"
          style={{
            width: TOOLTIP_WIDTH,
            transform: `translate3d(${tooltip.left}px, ${tooltip.top}px, 0)`,
          }}
        >
          <div
            key={step.id}
            className="animate-in fade-in slide-in-from-bottom-1 duration-200"
          >
            <CardHeader className="px-4">
              <CardTitle>
                {step.title}
                <span className="ml-2 text-xs font-normal text-typography-secondary">
                  {tourStepIndex + 1} / {TOUR_STEPS.length}
                </span>
              </CardTitle>
              <CardDescription>{step.body}</CardDescription>
            </CardHeader>
            <CardFooter className="px-4 flex justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={() => stopTour(true)}>
                Skip
              </Button>
              <div className="flex gap-2">
                {tourStepIndex > 0 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTourStepIndex(tourStepIndex - 1)}
                  >
                    Back
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  onClick={() => {
                    if (isLast) stopTour(true);
                    else setTourStepIndex(tourStepIndex + 1);
                  }}
                >
                  {isLast ? "Done" : "Next"}
                </Button>
              </div>
            </CardFooter>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
