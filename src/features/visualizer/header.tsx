import { HelpCircle, Moon, Sun } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router";

import { UserGuideDialog, useVisualizerUi } from "./user-guide";

import { Button } from "~/components/ui/button";
import Logo from "~/components/ui/logo";
import { useTheme } from "~/hooks/use-theme";

const isTypingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest("input, textarea, select, [contenteditable=true]")
  );
};

export default function Header() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { setGuideOpen, stopTour, tourActive } = useVisualizerUi();
<<<<<<< Updated upstream
=======

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "?") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      if (tourActive) stopTour(true);
      setGuideOpen(true);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setGuideOpen, stopTour, tourActive]);
>>>>>>> Stashed changes

  return (
    <header className="flex items-center justify-between shrink-0 h-16 px-6 bg-gradient-to-r from-neutral-low/20 to-neutral/20 border-b border-b-border">
      {/* Logo + App Name */}
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => navigate("/")}
      >
        <Logo alt="NovaGraph" className="w-6 h-6 text-primary" />
        <span className="text-lg font-medium hidden sm:block">NovaGraph</span>
      </div>
      <div className="flex items-center gap-2">
        {/* Light/Dark Mode Toggle */}
        <Button
          title="Toggle Light/Dark Mode"
          variant="ghost"
          size="icon"
          onClick={() => toggleTheme()}
        >
          {theme === "dark" ? (
            <Sun className="w-6 h-6" />
          ) : (
            <Moon className="w-6 h-6" />
          )}
        </Button>
        <Button
          className="bg-neutral-low hover:bg-neutral-low/50"
          variant="outline"
          data-guide="user-guide"
          onClick={() => {
            if (tourActive) stopTour(true);
            setGuideOpen(true);
          }}
        >
          <HelpCircle className="w-6 h-6" />
          User Guide
        </Button>
        <UserGuideDialog />
      </div>
      <UserGuideDialog />
    </header>
  );
}
