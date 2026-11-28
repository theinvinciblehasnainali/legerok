import type { Board } from "@/types";
import type { LegeRokModule } from "@/sdk/types";
import { Button } from "@/components/ui/button";
import {
  FileSpreadsheet,
  LayoutGrid,
  Plug,
  Plus,
  Send,
  Table2,
} from "lucide-react";

export type ActiveRoute =
  | { type: "home" }
  | { type: "board"; boardId: string }
  | { type: "modules" }
  | { type: "module"; moduleId: string };

interface SidebarProps {
  boards: Board[];
  activeModules: LegeRokModule[];
  route: ActiveRoute;
  onNavigate: (route: ActiveRoute) => void;
  onOpenImport: () => void;
}

export function Sidebar({
  boards,
  activeModules,
  route,
  onNavigate,
  onOpenImport,
}: SidebarProps) {
  return (
    <aside className="w-60 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-col h-screen select-none">
      {/* Brand Header */}
      <div className="px-4 py-4 border-b border-sidebar-border">
        <button
          type="button"
          onClick={() => onNavigate({ type: "home" })}
          className="text-left w-full group"
        >
          <span className="text-lg font-semibold tracking-tight group-hover:text-primary transition-colors">
            LegeRok
          </span>
          <p className="text-xs text-muted-foreground">Local-first data tracker</p>
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        {/* Boards */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Boards
            </span>
            <button
              type="button"
              onClick={() => onNavigate({ type: "home" })}
              title="All boards / Create board"
              className="p-1 rounded-md hover:bg-sidebar-accent text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => onNavigate({ type: "home" })}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
              route.type === "home"
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "hover:bg-sidebar-accent/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid className="size-4 shrink-0" />
            <span className="truncate">All Boards</span>
          </button>

          {boards.map((board) => {
            const isActive =
              route.type === "board" && route.boardId === board.id;
            return (
              <button
                key={board.id}
                type="button"
                onClick={() => onNavigate({ type: "board", boardId: board.id })}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "hover:bg-sidebar-accent/60 text-sidebar-foreground"
                }`}
              >
                <Table2 className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{board.name}</span>
              </button>
            );
          })}

          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start mt-2"
            onClick={onOpenImport}
          >
            <FileSpreadsheet className="size-3.5" />
            Import Spreadsheet
          </Button>
        </div>

        {/* Active Modules */}
        {activeModules.length > 0 && (
          <div className="space-y-1.5">
            <div className="px-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Modules
              </span>
            </div>
            {activeModules.map((mod) => {
              const isActive =
                route.type === "module" && route.moduleId === mod.id;
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() =>
                    onNavigate({ type: "module", moduleId: mod.id })
                  }
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "hover:bg-sidebar-accent/60 text-sidebar-foreground"
                  }`}
                >
                  <Send className="size-4 shrink-0 text-primary" />
                  <span className="truncate">{mod.navLabel}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer: Modules Dock */}
      <div className="p-3 border-t border-sidebar-border">
        <button
          type="button"
          onClick={() => onNavigate({ type: "modules" })}
          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-sm transition-colors ${
            route.type === "modules"
              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              : "hover:bg-sidebar-accent/60 text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-2">
            <Plug className="size-4 shrink-0" />
            Modules
          </span>
          {activeModules.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
              {activeModules.length}
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}
