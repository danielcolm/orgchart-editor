import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/store";
import type { ViewMode } from "@/types/ui";

export function Toolbar() {
  const navigate = useNavigate();
  const projectName = useStore((s) => s.projectName);
  const viewMode = useStore((s) => s.viewMode);
  const setViewMode = useStore((s) => s.setViewMode);
  const nodeCount = useStore((s) => s.nodes.length);
  const focusNodeId = useStore((s) => s.focusNodeId);
  const collapsedNodes = useStore((s) => s.collapsedNodes);
  const resetView = useStore((s) => s.resetView);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const showNames = useStore((s) => s.showNames);
  const toggleShowNames = useStore((s) => s.toggleShowNames);
  const activeLanguage = useStore((s) => s.activeLanguage);
  const setActiveLanguage = useStore((s) => s.setActiveLanguage);
  const settings = useStore((s) => s.settings);

  const hasActiveView = focusNodeId !== null || collapsedNodes.size > 0;

  const tabs: { mode: ViewMode; label: string }[] = [
    { mode: "graph", label: "Graph" },
    { mode: "people", label: "People" },
    { mode: "history", label: "History" },
  ];

  return (
    <div style={S.bar}>
      <div style={S.left}>
        <button onClick={() => navigate("/")} style={S.home} title="Home">◂</button>
        <span style={S.name}>{projectName}</span>
        <span style={S.dot}>·</span>
        {tabs.map((t) => (
          <button key={t.mode} onClick={() => setViewMode(t.mode)}
            style={{ ...S.tab, ...(viewMode === t.mode ? S.tabOn : {}) }}>
            {t.label}
          </button>
        ))}
        <span style={S.count}>{nodeCount} nodes</span>
        {hasActiveView && (
          <button onClick={() => { resetView(); localStorage.removeItem("orgchart-focus-with-parents"); }} style={S.resetBtn}>Reset View</button>
        )}
      </div>
      <div style={S.right}>
        <button onClick={toggleShowNames} style={S.toolBtn} title="Toggle names">
          {showNames ? "Hide Names" : "Show Names"}
        </button>
        <button onClick={toggleTheme} style={S.toolBtn} title="Toggle theme">
          {theme === "dark" ? "☀" : "☾"}
        </button>
        {/* Language switcher */}
        <div style={S.langWrap}>
          {settings.languages.map((l) => (
            <button key={l.code} onClick={() => setActiveLanguage(l.code)}
              style={{ ...S.langBtn, ...(l.code === activeLanguage ? S.langActive : {}) }}>
              {l.code.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  bar: { height: 48, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", background: "var(--color-bg-elevated)", borderBottom: "1px solid var(--color-border-subtle)", flexShrink: 0 },
  left: { display: "flex", alignItems: "center", gap: 10 },
  home: { fontSize: 16, color: "var(--color-text-secondary)", padding: "4px 8px", borderRadius: "var(--radius-sm)" },
  name: { fontWeight: 600, fontSize: 14, color: "var(--color-text)" },
  dot: { color: "var(--color-text-muted)" },
  tab: { padding: "4px 12px", borderRadius: "var(--radius-sm)", fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)", transition: "all var(--transition-fast)" },
  tabOn: { background: "var(--color-bg-surface)", color: "var(--color-text)" },
  count: { fontSize: 12, color: "var(--color-text-muted)", marginLeft: 4 },
  right: { display: "flex", alignItems: "center", gap: 8 },
  resetBtn: { padding: "4px 12px", borderRadius: "var(--radius-sm)", background: "var(--color-accent-subtle)", border: "1px solid var(--color-accent)", color: "var(--color-accent)", fontSize: 12, fontWeight: 600 },
  toolBtn: { padding: "4px 10px", borderRadius: "var(--radius-sm)", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)", fontSize: 12, fontWeight: 500 },
  langWrap: { display: "flex", gap: 2, background: "var(--color-bg)", borderRadius: "var(--radius-sm)", padding: 2 },
  langBtn: { padding: "4px 10px", borderRadius: "var(--radius-sm)", fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", letterSpacing: "0.03em" },
  langActive: { background: "var(--color-accent)", color: "#fff" },
};
