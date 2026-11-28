import { useEffect, useMemo, useState } from "react";
import type { Board } from "@/types";
import { getBoards } from "@/lib/boards";
import { getModuleStates, setModuleEnabled } from "@/lib/modules";
import { AVAILABLE_MODULES, getModuleById } from "@/sdk/registry";
import { createLegeRokSDK } from "@/sdk/createSdk";
import { Sidebar, type ActiveRoute } from "@/components/layout/Sidebar";
import { BoardList } from "@/components/boards/BoardList";
import { BoardView } from "@/components/boards/BoardView";
import { CreateBoardModal } from "@/components/boards/CreateBoardModal";
import { ModulesView } from "@/components/modules/ModulesView";
import { ImportBoardModal } from "@/components/import/ImportBoardModal";

function App() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loadingBoards, setLoadingBoards] = useState(true);
  const [enabledModuleIds, setEnabledModuleIds] = useState<string[]>([]);
  const [route, setRoute] = useState<ActiveRoute>({ type: "home" });
  const [createBoardOpen, setCreateBoardOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const sdk = useMemo(() => createLegeRokSDK(), []);

  async function refreshBoards() {
    try {
      const data = await getBoards();
      setBoards(data);
    } catch (err) {
      console.error("Failed to load boards:", err);
    } finally {
      setLoadingBoards(false);
    }
  }

  async function refreshModules() {
    try {
      const states = await getModuleStates();
      setEnabledModuleIds(
        states.filter((s) => s.enabled === 1).map((s) => s.id)
      );
    } catch (err) {
      console.error("Failed to load module states:", err);
    }
  }

  useEffect(() => {
    void refreshBoards();
    void refreshModules();
  }, []);

  const activeModules = useMemo(
    () => AVAILABLE_MODULES.filter((m) => enabledModuleIds.includes(m.id)),
    [enabledModuleIds]
  );

  async function handleToggleModule(moduleId: string, enabled: boolean) {
    await setModuleEnabled(moduleId, enabled);
    await refreshModules();
    if (!enabled && route.type === "module" && route.moduleId === moduleId) {
      setRoute({ type: "modules" });
    }
  }

  function renderMain() {
    if (route.type === "board") {
      return (
        <BoardView
          boardId={route.boardId}
          onBoardsChanged={refreshBoards}
        />
      );
    }

    if (route.type === "modules") {
      return (
        <ModulesView
          enabledModuleIds={enabledModuleIds}
          onToggleModule={handleToggleModule}
          onOpenModule={(moduleId) => setRoute({ type: "module", moduleId })}
        />
      );
    }

    if (route.type === "module") {
      const mod = getModuleById(route.moduleId);
      if (mod && enabledModuleIds.includes(mod.id)) {
        return <>{mod.renderView(sdk)}</>;
      }
      return (
        <ModulesView
          enabledModuleIds={enabledModuleIds}
          onToggleModule={handleToggleModule}
          onOpenModule={(moduleId) => setRoute({ type: "module", moduleId })}
        />
      );
    }

    return (
      <BoardList
        boards={boards}
        loading={loadingBoards}
        onOpenBoard={(boardId) => setRoute({ type: "board", boardId })}
        onBoardsChanged={refreshBoards}
        onOpenCreate={() => setCreateBoardOpen(true)}
        onOpenImport={() => setImportOpen(true)}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar
        boards={boards}
        activeModules={activeModules}
        route={route}
        onNavigate={setRoute}
        onOpenCreateBoard={() => setCreateBoardOpen(true)}
        onOpenImport={() => setImportOpen(true)}
      />
      <main className="flex-1 overflow-y-auto">{renderMain()}</main>

      <CreateBoardModal
        open={createBoardOpen}
        onClose={() => setCreateBoardOpen(false)}
        onCreated={async (boardId) => {
          setCreateBoardOpen(false);
          await refreshBoards();
          setRoute({ type: "board", boardId });
        }}
      />

      <ImportBoardModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={async (boardId) => {
          setImportOpen(false);
          await refreshBoards();
          setRoute({ type: "board", boardId });
        }}
      />
    </div>
  );
}

export default App;
