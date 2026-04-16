import { useStore } from "@/store";
import { Toolbar } from "@/components/Toolbar/Toolbar";
import { Canvas } from "@/components/Canvas/Canvas";
import { PeopleView } from "@/components/Panels/PeopleView";
import { DetailPanel } from "@/components/Panels/DetailPanel";
import { HistoryView } from "@/components/Panels/HistoryView";
import { SettingsView } from "@/components/Panels/SettingsView";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export function EditorPage() {
  const viewMode = useStore((s) => s.viewMode);
  const projectId = useStore((s) => s.projectId);
  const selectedNodeId = useStore((s) => s.selectedNodeId);
  const navigate = useNavigate();

  useEffect(() => {
    if (!projectId) navigate("/");
  }, [projectId, navigate]);

  if (!projectId) return null;

  function renderContent() {
    switch (viewMode) {
      case "graph": return <Canvas />;
      case "people": return <PeopleView />;
      case "history": return <HistoryView />;
      case "settings": return <SettingsView />;
    }
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Toolbar />
      <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
        <div style={{ flex: 1, overflow: "hidden" }}>{renderContent()}</div>
        {viewMode === "graph" && selectedNodeId && <DetailPanel />}
      </div>
    </div>
  );
}
