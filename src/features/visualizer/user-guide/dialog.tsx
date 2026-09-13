import { useEffect, useMemo, useState } from "react";
import { Compass } from "lucide-react";

import { GUIDE_SECTIONS, type GuideSectionId } from "./content";
import { useVisualizerUi } from "./ui-context";

import { Button } from "~/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

const isTypingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      'input, textarea, select, [contenteditable="true"], .cm-editor, .cm-content, [role="textbox"]'
    )
  );
};

export default function UserGuideDialog() {
  const {
    guideOpen,
    setGuideOpen,
    guideSectionId,
    setGuideSectionId,
    tourActive,
    reveal,
  } = useVisualizerUi();
  const [search, setSearch] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "?") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      if (tourActive) return;
      event.preventDefault();
      setGuideOpen(!guideOpen);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [guideOpen, setGuideOpen, tourActive]);

  useEffect(() => {
    if (!guideOpen) setSearch("");
  }, [guideOpen]);

  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return GUIDE_SECTIONS.filter((section) => {
      const haystack = [section.title, ...section.body, ...section.keywords]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [search]);

  const selectSection = (id: GuideSectionId) => {
    setGuideSectionId(id);
    setSearch("");
  };

  return (
    <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
      <DialogContent className="flex flex-col gap-2 max-h-[80vh] !max-w-[min(100%,calc(80vw))]">
        <DialogHeader>
          <DialogTitle>User Guide</DialogTitle>
          <DialogDescription>
            Short handbook for the visualizer. Press ? to open it again.
          </DialogDescription>
        </DialogHeader>

        <Command
          className="relative overflow-visible rounded-md border border-border"
          shouldFilter={false}
        >
          <CommandInput
            placeholder="Search the guide..."
            value={search}
            onValueChange={setSearch}
          />
          {search.trim() ? (
            <CommandList className="absolute top-full right-0 left-0 z-10 mt-1 rounded-md border border-border bg-page shadow-md">
              <CommandEmpty>No matching sections.</CommandEmpty>
              <CommandGroup heading="Sections">
                {matches.map((section) => (
                  <CommandItem
                    key={section.id}
                    value={`${section.title} ${section.keywords.join(" ")}`}
                    onSelect={() => selectSection(section.id)}
                  >
                    {section.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          ) : null}
        </Command>

        <Tabs
          value={guideSectionId}
          onValueChange={(value) => setGuideSectionId(value as GuideSectionId)}
          className="flex-1 flex flex-col min-h-0"
        >
          <div className="mt-2 flex flex-col gap-4 md:flex-row flex-1 min-h-0">
            <TabsList className="flex justify-start max-w-full h-full overflow-x-visible">
              <div className="flex-shrink-0 flex gap-2 md:flex-col md:flex-nowrap">
                {GUIDE_SECTIONS.map((section) => (
                  <TabsTrigger
                    key={section.id}
                    value={section.id}
                    className="px-4 py-2 truncate data-[state=active]:bg-neutral justify-start"
                  >
                    {section.title}
                  </TabsTrigger>
                ))}
              </div>
            </TabsList>

            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
              {GUIDE_SECTIONS.map((section) => (
                <TabsContent
                  key={section.id}
                  value={section.id}
                  className="flex flex-col gap-4 data-[state=active]:flex"
                >
                  <h2 className="medium-title">{section.title}</h2>
                  <ul className="space-y-2 text-sm text-typography-secondary leading-relaxed list-disc pl-5">
                    {section.body.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  {section.cta ? (
                    <div>
                      <Button onClick={() => reveal(section.cta!.action)}>
                        {section.id === "start" ? <Compass /> : null}
                        {section.cta.label}
                      </Button>
                    </div>
                  ) : null}
                </TabsContent>
              ))}
            </div>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
