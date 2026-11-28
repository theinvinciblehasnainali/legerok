import { useState } from "react";
import type { LegeRokModule } from "@/sdk/types";
import { AVAILABLE_MODULES } from "@/sdk/registry";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GripVertical, Plug, Unplug, Sparkles } from "lucide-react";

interface ModulesViewProps {
  enabledModuleIds: string[];
  onToggleModule: (moduleId: string, enabled: boolean) => Promise<void>;
  onOpenModule: (moduleId: string) => void;
}

export function ModulesView({
  enabledModuleIds,
  onToggleModule,
  onOpenModule,
}: ModulesViewProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState<"available" | "active" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const enabledSet = new Set(enabledModuleIds);
  const availableModules = AVAILABLE_MODULES.filter((m) => !enabledSet.has(m.id));
  const activeModules = AVAILABLE_MODULES.filter((m) => enabledSet.has(m.id));

  async function handleSetEnabled(moduleId: string, enabled: boolean) {
    setBusyId(moduleId);
    try {
      await onToggleModule(moduleId, enabled);
    } finally {
      setBusyId(null);
      setDraggingId(null);
      setDragOverZone(null);
    }
  }

  function handleDragStart(e: React.DragEvent, moduleId: string) {
    setDraggingId(moduleId);
    e.dataTransfer.setData("text/plain", moduleId);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDrop(e: React.DragEvent, targetZone: "available" | "active") {
    e.preventDefault();
    const moduleId = e.dataTransfer.getData("text/plain") || draggingId;
    setDragOverZone(null);
    setDraggingId(null);
    if (!moduleId) return;

    const isCurrentlyEnabled = enabledSet.has(moduleId);
    if (targetZone === "active" && !isCurrentlyEnabled) {
      void handleSetEnabled(moduleId, true);
    } else if (targetZone === "available" && isCurrentlyEnabled) {
      void handleSetEnabled(moduleId, false);
    }
  }

  function renderModuleCard(mod: LegeRokModule, isActive: boolean) {
    const isBusy = busyId === mod.id;
    return (
      <Card
        key={mod.id}
        draggable={!isBusy}
        onDragStart={(e) => handleDragStart(e, mod.id)}
        onDragEnd={() => {
          setDraggingId(null);
          setDragOverZone(null);
        }}
        className={`cursor-grab active:cursor-grabbing transition-all ${
          draggingId === mod.id ? "opacity-50 scale-[0.98]" : "hover:ring-primary/40"
        }`}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <GripVertical className="size-4 text-muted-foreground shrink-0" />
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  {mod.name}
                  <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    v{mod.version}
                  </span>
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {mod.tagline}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{mod.description}</p>
          <div className="flex items-center justify-between gap-2 pt-1">
            {isActive ? (
              <>
                <Button size="sm" onClick={() => onOpenModule(mod.id)}>
                  Open {mod.navLabel}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isBusy}
                  onClick={() => void handleSetEnabled(mod.id, false)}
                >
                  <Unplug className="size-3.5" />
                  Unplug
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={isBusy}
                onClick={() => void handleSetEnabled(mod.id, true)}
              >
                <Plug className="size-3.5" />
                Plug in
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Modules</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Drag a module into the active dock to plug it into LegeRok, or drag it back out to keep your workspace minimal.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Available Modules */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverZone("available");
          }}
          onDragLeave={() => setDragOverZone(null)}
          onDrop={(e) => handleDrop(e, "available")}
          className={`rounded-2xl border-2 border-dashed p-5 space-y-4 min-h-[320px] transition-colors ${
            dragOverZone === "available"
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/20"
          }`}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Available Modules
            </h2>
            <span className="text-xs text-muted-foreground">
              {availableModules.length}
            </span>
          </div>

          {availableModules.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center text-sm text-muted-foreground">
              <Sparkles className="size-6 mb-2 opacity-50" />
              All available modules are plugged in.
            </div>
          ) : (
            <div className="space-y-3">
              {availableModules.map((mod) => renderModuleCard(mod, false))}
            </div>
          )}
        </div>

        {/* Active / Plugged-In Dock */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverZone("active");
          }}
          onDragLeave={() => setDragOverZone(null)}
          onDrop={(e) => handleDrop(e, "active")}
          className={`rounded-2xl border-2 border-dashed p-5 space-y-4 min-h-[320px] transition-colors ${
            dragOverZone === "active"
              ? "border-primary bg-primary/10"
              : "border-primary/30 bg-card"
          }`}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-primary uppercase tracking-wider flex items-center gap-1.5">
              <Plug className="size-3.5" />
              Plugged-In Modules
            </h2>
            <span className="text-xs text-muted-foreground">
              {activeModules.length}
            </span>
          </div>

          {activeModules.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center text-sm text-muted-foreground">
              <Plug className="size-6 mb-2 opacity-40" />
              Drag a module here to plug it in and add it to your sidebar.
            </div>
          ) : (
            <div className="space-y-3">
              {activeModules.map((mod) => renderModuleCard(mod, true))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
