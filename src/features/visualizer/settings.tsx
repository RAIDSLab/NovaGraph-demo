import type { ReactNode } from "react";
import { ChevronsLeft, ChevronsRight, Settings } from "lucide-react";
import { observer } from "mobx-react-lite";

import {
  DEFAULT_GRAPH_RENDER_SETTINGS,
  GRAVITY,
  NODE_SIZE_SCALE,
  type Gravity,
  type NodeSizeScale,
} from "./renderer/constant";
import { useStore } from "./hooks/use-store";

import { Input } from "~/components/form/input";
import { Label } from "~/components/form/label";
import { RadioGroup, RadioGroupItem } from "~/components/form/radio-group";
import { Switch } from "~/components/form/switch";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "~/components/ui/sidebar";
import { useIsMobile } from "~/hooks/use-mobile";

export default function SettingsSidebar() {
  return (
    <SidebarProvider
      name="config-sidebar"
      className="relative isolate z-10"
      defaultOpen={false}
    >
      <SettingsSidebarWrapper />
    </SidebarProvider>
  );
}

const SettingsSidebarWrapper = observer(() => {
  const store = useStore();
  const isMobile = useIsMobile();
  const { open, openMobile } = useSidebar();

  return (
    <>
      <Sidebar side="right">
        <SettingsSidebarContent open={isMobile ? openMobile : open} store={store} />
      </Sidebar>
      <SettingsSidebarControls open={isMobile ? openMobile : open} />
    </>
  );
});

const SettingsSidebarContent = observer(function SettingsSidebarContent({
  open,
  store,
}: {
  open: boolean;
  store: ReturnType<typeof useStore>;
}) {
  const disabled = !open;

  return (
    <SidebarContent className="p-6 space-y-4 bg-gradient-to-br from-neutral-low/20 to-neutral/20 max-h-full overflow-y-auto">
      <h1 className="medium-title">Graph Options</h1>

      <SettingsSection
        title="Gravity Strength"
        description="Modifies the gravitation strength of the center of the graph"
      >
        <RadioGroup
          defaultValue={String(store.gravity)}
          onValueChange={(value) => store.setGravity(Number(value) as Gravity)}
          disabled={disabled}
          inert={disabled}
        >
          {Object.entries(GRAVITY).map(([key, val]) => (
            <div key={key} className="flex items-center gap-2">
              <RadioGroupItem value={String(val)} id={`gravity-${key}`} />
              <Label htmlFor={`gravity-${key}`} className="capitalize font-normal">
                {key.replace(/_/g, " ").toLowerCase()}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </SettingsSection>

      <Separator />

      <SettingsSection
        title="Node Scalar Size"
        description="Modify the sizes for all nodes"
      >
        <RadioGroup
          defaultValue={String(store.nodeSizeScale)}
          onValueChange={(value) =>
            store.setNodeSizeScale(Number(value) as NodeSizeScale)
          }
          disabled={disabled}
          inert={disabled}
        >
          {Object.entries(NODE_SIZE_SCALE).map(([key, val]) => (
            <div key={key} className="flex items-center gap-2">
              <RadioGroupItem value={String(val)} id={`node-size-${key}`} />
              <Label
                htmlFor={`node-size-${key}`}
                className="capitalize font-normal"
              >
                {key.replace(/_/g, " ").toLowerCase()}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </SettingsSection>

      <Separator />

      <SettingsSection
        title="Rendering & simulation"
        description="Performance and layout tuning for the graph canvas"
      >
        <div className="space-y-4">
          <NumberSetting
            id="large-graph-threshold"
            label="Large graph edge threshold"
            description="Above this edge count, the graph loads paused with labels off (unless overridden below)."
            value={store.largeGraphEdgeThreshold}
            min={0}
            step={500}
            disabled={disabled}
            onCommit={(v) => store.setLargeGraphEdgeThreshold(v)}
          />

          <SettingSwitchRow
            id="default-dynamic-labels"
            label="Default dynamic labels"
            description="When the graph is below the large-graph threshold, show dynamic labels on load."
            checked={store.defaultShowDynamicLabels}
            disabled={disabled}
            onCheckedChange={store.setDefaultShowDynamicLabels}
          />

          <div className="space-y-2">
            <Label className="small-title">Link visibility LOD (px)</Label>
            <p className="small-body text-typography-secondary">
              Edges fade between near and far zoom distances.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <NumberSetting
                id="link-lod-near"
                label="Near"
                value={store.linkVisibilityDistanceNear}
                min={0}
                step={5}
                disabled={disabled}
                onCommit={(v) =>
                  store.setLinkVisibilityDistanceRange(
                    v,
                    store.linkVisibilityDistanceFar
                  )
                }
              />
              <NumberSetting
                id="link-lod-far"
                label="Far"
                value={store.linkVisibilityDistanceFar}
                min={1}
                step={5}
                disabled={disabled}
                onCommit={(v) =>
                  store.setLinkVisibilityDistanceRange(
                    store.linkVisibilityDistanceNear,
                    v
                  )
                }
              />
            </div>
          </div>

          <NumberSetting
            id="simulation-decay"
            label="Simulation decay"
            description="Higher values let the layout run longer before cooling down (100–200000)."
            value={store.simulationDecay}
            min={100}
            max={200_000}
            step={500}
            disabled={disabled}
            onCommit={(v) => store.setSimulationDecay(v)}
          />

          <SettingSwitchRow
            id="auto-pause-simulation"
            label="Auto-pause when layout settles"
            description="Pause the simulation after it cools down (and when not forced by an algorithm run)."
            checked={store.autoPauseOnSimulationEnd}
            disabled={disabled}
            onCheckedChange={store.setAutoPauseOnSimulationEnd}
          />

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={disabled}
            onClick={() => store.resetGraphRenderSettings()}
          >
            Reset rendering defaults
          </Button>
          <p className="text-xs text-typography-tertiary">
            Defaults: threshold{" "}
            {DEFAULT_GRAPH_RENDER_SETTINGS.largeGraphEdgeThreshold}, labels{" "}
            {DEFAULT_GRAPH_RENDER_SETTINGS.defaultShowDynamicLabels ? "on" : "off"}
            , LOD{" "}
            {DEFAULT_GRAPH_RENDER_SETTINGS.linkVisibilityDistanceRange.join("–")}
            , decay {DEFAULT_GRAPH_RENDER_SETTINGS.simulationDecay}.
          </p>
        </div>
      </SettingsSection>
    </SidebarContent>
  );
});

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h2 className="small-title">{title}</h2>
        <p className="small-body text-typography-secondary">{description}</p>
      </div>
      {children}
    </div>
  );
}

function SettingSwitchRow({
  id,
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-1 min-w-0">
        <Label htmlFor={id} className="font-normal">
          {label}
        </Label>
        {description ? (
          <p className="text-xs text-typography-secondary">{description}</p>
        ) : null}
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

function NumberSetting({
  id,
  label,
  description,
  value,
  min,
  max,
  step = 1,
  disabled,
  onCommit,
}: {
  id: string;
  label: string;
  description?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onCommit: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
      {description ? (
        <p className="text-xs text-typography-secondary">{description}</p>
      ) : null}
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const parsed = Number(e.target.value);
          if (Number.isFinite(parsed)) onCommit(parsed);
        }}
      />
    </div>
  );
}

function SettingsSidebarControls({ open }: { open: boolean }) {
  const isMobile = useIsMobile();

  return (
    <div
      className={`bg-page isolate overflow-hidden before:absolute before:bg-gradient-to-br before:from-neutral-low/20 before:to-neutral/20 before:inset-0 before:-z-10 p-2 flex flex-col items-center gap-2 h-max absolute top-1/2 -translate-y-1/2 ${
        !open || isMobile ? "right-0" : "right-[calc(var(--sidebar-width))]"
      } transition-all duration-200 ease-linear border border-r-transparent border-border rounded-tl-md rounded-bl-md`}
    >
      <SidebarTrigger size="icon" title="Open Visualiser's Settings Sidebar">
        {!open || isMobile ? (
          <ChevronsLeft className="w-6 h-6" />
        ) : (
          <ChevronsRight className="w-6 h-6" />
        )}
      </SidebarTrigger>
      <Separator />
      <Settings className="w-6 h-6" />
    </div>
  );
}
