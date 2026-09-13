import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_TOUR_PANEL_LAYOUT,
  GUIDE_SECTIONS,
  resolveTourPanelLayout,
  TOUR_SEEN_KEY,
  TOUR_STEPS,
  type GuideAction,
  type GuideSectionId,
} from "./content";

type VisualizerUiContextValue = {
  guideOpen: boolean;
  setGuideOpen: (open: boolean) => void;
  guideSectionId: GuideSectionId;
  setGuideSectionId: (id: GuideSectionId) => void;
  tourActive: boolean;
  tourStepIndex: number;
  setTourStepIndex: (index: number) => void;
  startTour: () => void;
  stopTour: (markSeen?: boolean) => void;
  importDialogOpen: boolean;
  setImportDialogOpen: (open: boolean) => void;
  outputDrawerOpen: boolean;
  setOutputDrawerOpen: (open: boolean) => void;
  algorithmSidebarOpen: boolean;
  setAlgorithmSidebarOpen: (open: boolean) => void;
  settingsSidebarOpen: boolean;
  setSettingsSidebarOpen: (open: boolean) => void;
  createNodeRequestId: number;
  revealId: number;
  revealAction: GuideAction | null;
  reveal: (action: GuideAction) => void;
};

const VisualizerUiContext = createContext<VisualizerUiContextValue | null>(
  null
);

const waitForDialogExit = () =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, 220);
  });

export const markTourSeen = () => {
  try {
    localStorage.setItem(TOUR_SEEN_KEY, "1");
  } catch {
    // Ignore quota / private-mode failures.
  }
};

export const hasSeenTour = () => {
  try {
    return localStorage.getItem(TOUR_SEEN_KEY) === "1";
  } catch {
    return true;
  }
};

export function VisualizerUiProvider({ children }: { children: ReactNode }) {
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideSectionId, setGuideSectionId] = useState<GuideSectionId>(
    GUIDE_SECTIONS[0].id
  );
  const [tourActive, setTourActive] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [outputDrawerOpen, setOutputDrawerOpen] = useState(false);
  const [algorithmSidebarOpen, setAlgorithmSidebarOpen] = useState(true);
  const [settingsSidebarOpen, setSettingsSidebarOpen] = useState(false);
  const [createNodeRequestId, setCreateNodeRequestId] = useState(0);
  const [revealId, setRevealId] = useState(0);
  const [revealAction, setRevealAction] = useState<GuideAction | null>(null);

  const applyAction = useCallback((action: GuideAction) => {
    switch (action) {
      case "start-tour": {
        setImportDialogOpen(false);
        setTourStepIndex(0);
        const layout = resolveTourPanelLayout(TOUR_STEPS[0]?.prepare);
        setAlgorithmSidebarOpen(layout.algorithms);
        setSettingsSidebarOpen(layout.settings);
        setOutputDrawerOpen(layout.output);
        setTourActive(true);
        break;
      }
      case "open-import":
        setImportDialogOpen(true);
        break;
      case "open-create-node":
        setCreateNodeRequestId((id) => id + 1);
        break;
      case "open-algorithms":
        setAlgorithmSidebarOpen(true);
        break;
      case "open-settings":
        setSettingsSidebarOpen(true);
        break;
      case "open-output":
        setOutputDrawerOpen(true);
        break;
      case "close-guide":
        break;
    }
  }, []);

  const startTour = useCallback(() => {
    setGuideOpen(false);
    setImportDialogOpen(false);
    setTourStepIndex(0);
    const layout = resolveTourPanelLayout(TOUR_STEPS[0]?.prepare);
    setAlgorithmSidebarOpen(layout.algorithms);
    setSettingsSidebarOpen(layout.settings);
    setOutputDrawerOpen(layout.output);
    setTourActive(true);
  }, []);

  const stopTour = useCallback((markSeen = true) => {
    setTourActive(false);
    setTourStepIndex(0);
    setAlgorithmSidebarOpen(DEFAULT_TOUR_PANEL_LAYOUT.algorithms);
    setSettingsSidebarOpen(DEFAULT_TOUR_PANEL_LAYOUT.settings);
    setOutputDrawerOpen(DEFAULT_TOUR_PANEL_LAYOUT.output);
    if (markSeen) markTourSeen();
  }, []);

  const reveal = useCallback(
    (action: GuideAction) => {
      setGuideOpen(false);
      setRevealAction(action);
      setRevealId((id) => id + 1);

      if (action === "start-tour") {
        void waitForDialogExit().then(() => applyAction(action));
        return;
      }

      if (action === "open-import" || action === "open-create-node") {
        void waitForDialogExit().then(() => applyAction(action));
        return;
      }

      applyAction(action);
    },
    [applyAction]
  );

  const value = useMemo<VisualizerUiContextValue>(
    () => ({
      guideOpen,
      setGuideOpen,
      guideSectionId,
      setGuideSectionId,
      tourActive,
      tourStepIndex,
      setTourStepIndex,
      startTour,
      stopTour,
      importDialogOpen,
      setImportDialogOpen,
      outputDrawerOpen,
      setOutputDrawerOpen,
      algorithmSidebarOpen,
      setAlgorithmSidebarOpen,
      settingsSidebarOpen,
      setSettingsSidebarOpen,
      createNodeRequestId,
      revealId,
      revealAction,
      reveal,
    }),
    [
      guideOpen,
      guideSectionId,
      tourActive,
      tourStepIndex,
      startTour,
      stopTour,
      importDialogOpen,
      outputDrawerOpen,
      algorithmSidebarOpen,
      settingsSidebarOpen,
      createNodeRequestId,
      revealId,
      revealAction,
      reveal,
    ]
  );

  return (
    <VisualizerUiContext.Provider value={value}>
      {children}
    </VisualizerUiContext.Provider>
  );
}

export const useVisualizerUi = () => {
  const context = useContext(VisualizerUiContext);
  if (!context) {
    throw new Error(
      "useVisualizerUi must be used within a VisualizerUiProvider"
    );
  }
  return context;
};
