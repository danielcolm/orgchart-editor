import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/store";
import * as db from "@/services/dbService";

export function WorkspaceManager() {
  const navigate = useNavigate();
  const store = useStore();
  const projects = useStore((s) => s.projects);
  const loadProjects = useStore((s) => s.loadProjects);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => { loadProjects(); }, []);

  async function handleNew() {
    const name = prompt("Project name:", "New Project");
    if (!name) return;
    const project = await db.createProject(name);
    // Create root node
    const now = Date.now();
    const rootTranslations: Record<string, unknown> = {};
    for (const lang of project.settings.languages) {
      rootTranslations[lang.code] = {
        name, description: "", mandate: "", responsibility: "",
        authority: "", tasks: "", kpi: "", updatedAt: now,
      };
    }
    await db.upsertNode({
      id: crypto.randomUUID(),
      projectId: project.id,
      parentId: null,
      isStaff: false,
      order: 0,
      staffLayout: "horizontal",
      childrenLayout: "horizontal",
      assignedPeople: [],
      tags: [],
      note: "",
      translations: rootTranslations as any,
    });
    await loadProjects();
    store.openProject(project.id).then(() => navigate(`/editor/${project.id}`));
  }

  async function handleOpen(id: string) {
    await store.openProject(id);
    navigate(`/editor/${id}`);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete project "${name}"? This cannot be undone.`)) return;
    await db.deleteProject(id);
    await loadProjects();
  }

  async function handleDuplicate(id: string) {
    const source = await db.fetchProject(id);
    const nodes = await db.fetchNodes(id);
    const relations = await db.fetchRelations(id);
    const people = await db.fetchPeople(id);

    const newProject = await db.createProject(`${source.name} (copy)`, source.settings);

    const idMap = new Map<string, string>();
    for (const p of people) {
      const newUid = crypto.randomUUID();
      idMap.set(p.uid, newUid);
      await db.upsertPerson({ ...p, uid: newUid, projectId: newProject.id });
    }
    for (const n of nodes) {
      const newId = crypto.randomUUID();
      idMap.set(n.id, newId);
    }
    for (const n of nodes) {
      await db.upsertNode({
        ...n,
        id: idMap.get(n.id)!,
        projectId: newProject.id,
        parentId: n.parentId ? idMap.get(n.parentId) ?? null : null,
        assignedPeople: n.assignedPeople.map((uid) => idMap.get(uid) ?? uid),
      });
    }
    for (const r of relations) {
      await db.upsertRelation({
        ...r,
        id: crypto.randomUUID(),
        projectId: newProject.id,
        sourceId: idMap.get(r.sourceId) ?? r.sourceId,
        targetId: idMap.get(r.targetId) ?? r.targetId,
      });
    }
    await loadProjects();
  }

  async function handleRename(id: string) {
    const trimmed = renameValue.trim();
    if (!trimmed) { setRenamingId(null); return; }
    await db.updateProject(id, { name: trimmed });
    await loadProjects();
    setRenamingId(null);
  }

  return (
    <div style={S.page}>
      <div style={S.container}>
        <div style={S.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={S.logo} />
            <div>
              <h1 style={S.title}>OrgChart Editor</h1>
              <p style={S.subtitle}>Multilingual organization chart editor</p>
            </div>
          </div>
          <button onClick={toggleTheme} style={S.themeBtn} title="Toggle theme">
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </div>

        <div style={S.actions}>
          <button onClick={handleNew} style={S.btnPrimary}>+ New Project</button>
        </div>

        {projects.length > 0 && (
          <div style={S.listSection}>
            <h2 style={S.listTitle}>Projects</h2>
            {projects.map((p) => (
              <div key={p.id} style={S.entry}>
                <div style={S.entryMain} onClick={() => handleOpen(p.id)}>
                  {renamingId === p.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => handleRename(p.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(p.id);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      style={S.renameInput}
                    />
                  ) : (
                    <span style={S.entryName}>{p.name}</span>
                  )}
                  <span style={S.entryMeta}>
                    {new Date(p.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <div style={S.entryActions}>
                  <button style={S.entryBtn} onClick={(e) => { e.stopPropagation(); setRenamingId(p.id); setRenameValue(p.name); }} title="Rename">✎</button>
                  <button style={S.entryBtn} onClick={(e) => { e.stopPropagation(); handleDuplicate(p.id); }} title="Duplicate">⧉</button>
                  <button style={{ ...S.entryBtn, color: "var(--color-danger)" }} onClick={(e) => { e.stopPropagation(); handleDelete(p.id, p.name); }} title="Delete">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-bg)" },
  container: { width: 520, padding: 40 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 36 },
  logo: { width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: "linear-gradient(135deg, var(--color-accent), #a78bfa)" },
  title: { fontSize: 22, fontWeight: 700, lineHeight: 1.2 },
  subtitle: { fontSize: 13, color: "var(--color-text-secondary)", marginTop: 2 },
  themeBtn: { fontSize: 20, padding: "6px 10px", borderRadius: "var(--radius-md)", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)" },
  actions: { display: "flex", flexDirection: "column", gap: 8 },
  btnPrimary: { padding: "12px 20px", borderRadius: "var(--radius-md)", background: "var(--color-accent)", color: "#fff", fontWeight: 600, fontSize: 14 },
  listSection: { marginTop: 32 },
  listTitle: { fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 8 },
  entry: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: "var(--radius-md)", cursor: "pointer", marginBottom: 2 },
  entryMain: { display: "flex", flexDirection: "column" as const, gap: 2, flex: 1, minWidth: 0 },
  entryName: { fontWeight: 600, fontSize: 13 },
  entryMeta: { fontSize: 11, color: "var(--color-text-muted)" },
  entryActions: { display: "flex", gap: 4, flexShrink: 0, marginLeft: 12 },
  entryBtn: { width: 28, height: 28, borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "var(--color-text-secondary)" },
  renameInput: { background: "var(--color-bg)", border: "1px solid var(--color-accent)", borderRadius: "var(--radius-sm)", padding: "2px 8px", fontSize: 13, fontWeight: 600, color: "var(--color-text)", outline: "none" },
};
