import { useState, useEffect } from "react";
import { useStore } from "@/store";
import type { TranslationEntry, Person } from "@/types/project";

export function DetailPanel() {
  const nodes = useStore((s) => s.nodes);
  const setNodes = useStore((s) => s.setNodes);
  const syncNodes = useStore((s) => s.syncNodes);
  const people = useStore((s) => s.people);
  const addPerson = useStore((s) => s.addPerson);
  const removePerson = useStore((s) => s.removePerson);
  const selectedNodeId = useStore((s) => s.selectedNodeId);
  const activeLanguage = useStore((s) => s.activeLanguage);
  const settings = useStore((s) => s.settings);
  const takeSnapshot = useStore((s) => s.takeSnapshot);

  const node = nodes.find((n) => n.id === selectedNodeId);
  const [noteValue, setNoteValue] = useState("");

  useEffect(() => {
    setNoteValue(node?.note ?? "");
  }, [selectedNodeId, node?.note]);

  if (!node) {
    return <div style={S.panel}><div style={S.empty}>Select a node to see details</div></div>;
  }

  const t: TranslationEntry = node.translations[activeLanguage] ?? {
    name: "", description: "", mandate: "", responsibility: "",
    authority: "", tasks: "", kpi: "", updatedAt: 0,
  };

  function updateField(field: keyof TranslationEntry, value: string) {
    if (!node) return;
    const existing = node.translations[activeLanguage] ?? {
      name: "", description: "", mandate: "", responsibility: "",
      authority: "", tasks: "", kpi: "", updatedAt: 0,
    };
    const updated = nodes.map((n) =>
      n.id === node.id
        ? { ...n, translations: { ...n.translations, [activeLanguage]: { ...existing, [field]: value, updatedAt: Date.now() } } }
        : n
    );
    setNodes(updated);
    syncNodes();
  }

  function updateNote() {
    if (!node) return;
    const updated = nodes.map((n) => n.id === node.id ? { ...n, note: noteValue } : n);
    setNodes(updated);
    syncNodes();
  }

  // People assigned to this node
  const assignedPeople = (node.assignedPeople ?? [])
    .map((uid) => people.find((p) => p.uid === uid))
    .filter(Boolean) as Person[];

  async function handleAddPerson() {
    if (!node) return;
    const firstName = prompt("First name:");
    if (!firstName?.trim()) return;
    const lastName = prompt("Last name:") ?? "";
    takeSnapshot("Add person");
    const person = await addPerson({
      uid: crypto.randomUUID(),
      projectId: node.projectId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      birthDate: null,
      hireDate: null,
      gender: null,
    });
    const updated = nodes.map((n) =>
      n.id === node.id ? { ...n, assignedPeople: [...(n.assignedPeople ?? []), person.uid] } : n
    );
    setNodes(updated);
    syncNodes();
  }

  function handleRemovePersonFromRole(uid: string) {
    if (!node) return;
    takeSnapshot("Remove person from role");
    const updated = nodes.map((n) =>
      n.id === node.id ? { ...n, assignedPeople: n.assignedPeople.filter((u) => u !== uid) } : n
    );
    setNodes(updated);
    syncNodes();
  }

  // Assign existing person
  function handleAssignExisting() {
    if (!node) return;
    const unassigned = people.filter((p) => !node.assignedPeople.includes(p.uid));
    if (unassigned.length === 0) { alert("No unassigned people available. Add a new person instead."); return; }
    const names = unassigned.map((p, i) => `${i + 1}. ${p.firstName} ${p.lastName}`).join("\n");
    const choice = prompt(`Assign person:\n${names}\n\nEnter number:`);
    if (!choice) return;
    const idx = parseInt(choice) - 1;
    if (idx < 0 || idx >= unassigned.length) return;
    takeSnapshot("Assign person");
    const updated = nodes.map((n) =>
      n.id === node.id ? { ...n, assignedPeople: [...n.assignedPeople, unassigned[idx].uid] } : n
    );
    setNodes(updated);
    syncNodes();
  }

  // Tags
  const availableTags = settings.tags ?? [];
  const nodeTags = node.tags ?? [];

  function toggleTag(tagId: string) {
    if (!node) return;
    takeSnapshot("Toggle tag");
    const current = node.tags ?? [];
    const newTags = current.includes(tagId)
      ? current.filter((t) => t !== tagId)
      : [...current, tagId];
    const updated = nodes.map((n) => n.id === node.id ? { ...n, tags: newTags } : n);
    setNodes(updated);
    syncNodes();
  }

  // Level
  function getLevel(nodeId: string): number {
    let level = 1;
    let current = nodes.find((n) => n.id === nodeId);
    while (current?.parentId) {
      level++;
      current = nodes.find((n) => n.id === current!.parentId);
    }
    return level;
  }

  const ROLE_FIELDS: { key: keyof TranslationEntry; label: string }[] = [
    { key: "mandate", label: "Mandate" },
    { key: "responsibility", label: "Responsibility" },
    { key: "authority", label: "Authority" },
    { key: "tasks", label: "Tasks" },
    { key: "kpi", label: "KPI" },
  ];

  return (
    <div style={S.panel}>
      <div style={S.header}>
        <h3 style={S.title}>Role Details</h3>
        <span style={S.level}>Level {getLevel(node.id)}</span>
      </div>

      {/* Name + Description */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Name ({activeLanguage.toUpperCase()})</div>
        <input
          value={t.name}
          onChange={(e) => updateField("name", e.target.value)}
          style={S.input}
        />
      </div>

      <div style={S.section}>
        <div style={S.sectionTitle}>Description ({activeLanguage.toUpperCase()})</div>
        <input
          value={t.description}
          onChange={(e) => updateField("description", e.target.value)}
          style={S.input}
        />
      </div>

      {/* Role fields */}
      {ROLE_FIELDS.map((f) => (
        <div key={f.key} style={S.section}>
          <div style={S.sectionTitle}>{f.label} ({activeLanguage.toUpperCase()})</div>
          <textarea
            value={(t as any)[f.key] ?? ""}
            onChange={(e) => updateField(f.key, e.target.value)}
            style={S.textarea}
            rows={2}
          />
        </div>
      ))}

      {/* People */}
      <div style={S.section}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={S.sectionTitle}>Assigned People ({assignedPeople.length})</div>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={handleAssignExisting} style={S.addBtn} title="Assign existing">⊕</button>
            <button onClick={handleAddPerson} style={S.addBtn} title="Create & assign new person">+</button>
          </div>
        </div>
        {assignedPeople.length === 0 && <p style={S.emptyHint}>No people assigned</p>}
        {assignedPeople.map((p) => (
          <div key={p.uid} style={S.personRow}>
            <span style={S.personName}>{p.firstName} {p.lastName}</span>
            <button onClick={() => handleRemovePersonFromRole(p.uid)} style={S.removeBtn} title="Remove from role">✕</button>
          </div>
        ))}
      </div>

      {/* Tags */}
      {availableTags.length > 0 && (
        <div style={S.section}>
          <div style={S.sectionTitle}>Tags</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {availableTags.map((tag) => {
              const active = nodeTags.includes(tag.id);
              return (
                <button key={tag.id} onClick={() => toggleTag(tag.id)}
                  style={{
                    ...S.tagBtn,
                    background: active ? tag.color : "var(--color-bg)",
                    color: active ? "#fff" : "var(--color-text-secondary)",
                    border: `1px solid ${active ? tag.color : "var(--color-border)"}`,
                  }}>
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Note */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Note</div>
        <textarea value={noteValue} onChange={(e) => setNoteValue(e.target.value)}
          onBlur={updateNote} style={S.textarea} rows={3} />
      </div>

      {/* Children reorder */}
      <ChildrenReorder nodeId={node.id} />
    </div>
  );
}

function ChildrenReorder({ nodeId }: { nodeId: string }) {
  const nodes = useStore((s) => s.nodes);
  const setNodes = useStore((s) => s.setNodes);
  const syncNodes = useStore((s) => s.syncNodes);
  const activeLanguage = useStore((s) => s.activeLanguage);
  const settings = useStore((s) => s.settings);
  const takeSnapshot = useStore((s) => s.takeSnapshot);

  const staffChildren = nodes.filter((n) => n.parentId === nodeId && n.isStaff).sort((a, b) => a.order - b.order);
  const regularChildren = nodes.filter((n) => n.parentId === nodeId && !n.isStaff).sort((a, b) => a.order - b.order);

  function getName(n: typeof nodes[0]): string {
    return n.translations[activeLanguage]?.name ?? n.translations[settings.dominantLanguage]?.name ?? n.id;
  }

  function move(list: typeof nodes, index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= list.length) return;
    takeSnapshot("Reorder children");
    const reordered = [...list];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    const updated = nodes.map((n) => {
      const idx = reordered.findIndex((r) => r.id === n.id);
      return idx >= 0 ? { ...n, order: idx } : n;
    });
    setNodes(updated);
    syncNodes();
  }

  if (staffChildren.length === 0 && regularChildren.length === 0) return null;

  return (
    <>
      {staffChildren.length > 0 && (
        <div style={reorderStyles.section}>
          <div style={reorderStyles.title}>Staff Children Order</div>
          {staffChildren.map((c, i) => (
            <div key={c.id} style={reorderStyles.row}>
              <span style={reorderStyles.name}>{getName(c)}</span>
              <button onClick={() => move(staffChildren, i, -1)} disabled={i === 0} style={reorderStyles.btn}>↑</button>
              <button onClick={() => move(staffChildren, i, 1)} disabled={i === staffChildren.length - 1} style={reorderStyles.btn}>↓</button>
            </div>
          ))}
        </div>
      )}
      {regularChildren.length > 0 && (
        <div style={reorderStyles.section}>
          <div style={reorderStyles.title}>Children Order</div>
          {regularChildren.map((c, i) => (
            <div key={c.id} style={reorderStyles.row}>
              <span style={reorderStyles.name}>{getName(c)}</span>
              <button onClick={() => move(regularChildren, i, -1)} disabled={i === 0} style={reorderStyles.btn}>↑</button>
              <button onClick={() => move(regularChildren, i, 1)} disabled={i === regularChildren.length - 1} style={reorderStyles.btn}>↓</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

const reorderStyles: Record<string, React.CSSProperties> = {
  section: { marginBottom: 14 },
  title: { fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: "0.04em" },
  row: { display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: "var(--radius-sm)", background: "var(--color-bg-surface)", marginBottom: 3 },
  name: { flex: 1, fontSize: 12, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  btn: { width: 22, height: 22, borderRadius: 4, background: "var(--color-bg)", border: "1px solid var(--color-border)", fontSize: 11, color: "var(--color-text-secondary)", cursor: "pointer" },
};

const S: Record<string, React.CSSProperties> = {
  panel: { width: 320, height: "100%", overflow: "auto", borderLeft: "1px solid var(--color-border-subtle)", background: "var(--color-bg-elevated)", padding: 16, flexShrink: 0 },
  empty: { color: "var(--color-text-muted)", fontSize: 13, padding: 24, textAlign: "center" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 14, fontWeight: 700 },
  level: { fontSize: 11, fontWeight: 600, color: "var(--color-accent)", background: "var(--color-accent-subtle)", padding: "2px 8px", borderRadius: 8 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: "0.04em" },
  input: { width: "100%", padding: "6px 10px", borderRadius: "var(--radius-sm)", background: "var(--color-bg)", border: "1px solid var(--color-border)", color: "var(--color-text)", fontSize: 13 },
  textarea: { width: "100%", padding: "6px 10px", borderRadius: "var(--radius-sm)", background: "var(--color-bg)", border: "1px solid var(--color-border)", color: "var(--color-text)", fontSize: 13, resize: "vertical" as const, fontFamily: "inherit" },
  addBtn: { width: 24, height: 24, borderRadius: "var(--radius-sm)", background: "var(--color-accent-subtle)", color: "var(--color-accent)", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--color-accent)" },
  emptyHint: { fontSize: 12, color: "var(--color-text-muted)", fontStyle: "italic" },
  personRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", borderRadius: "var(--radius-sm)", background: "var(--color-bg-surface)", marginTop: 4 },
  personName: { fontSize: 13, fontWeight: 500, color: "var(--color-accent)" },
  removeBtn: { fontSize: 12, color: "var(--color-text-muted)", padding: "2px 6px" },
  tagBtn: { padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, cursor: "pointer" },
};
