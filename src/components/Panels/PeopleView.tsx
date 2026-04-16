import { useStore } from "@/store";

export function PeopleView() {
  const people = useStore((s) => s.people);
  const nodes = useStore((s) => s.nodes);
  const setNodes = useStore((s) => s.setNodes);
  const syncNodes = useStore((s) => s.syncNodes);
  const removePerson = useStore((s) => s.removePerson);
  const takeSnapshot = useStore((s) => s.takeSnapshot);
  const activeLanguage = useStore((s) => s.activeLanguage);
  const settings = useStore((s) => s.settings);

  function getRoles(uid: string): string[] {
    return nodes
      .filter((n) => n.assignedPeople?.includes(uid))
      .map((n) => n.translations[activeLanguage]?.name ?? n.translations[settings.dominantLanguage]?.name ?? n.id);
  }

  async function handleDelete(uid: string, fullName: string) {
    const rolesCount = nodes.filter((n) => n.assignedPeople?.includes(uid)).length;
    const extra = rolesCount > 0 ? `\nThis person is assigned to ${rolesCount} role(s) — they will be unassigned.` : "";
    if (!confirm(`Delete "${fullName}"?${extra}`)) return;
    takeSnapshot("Delete person");
    // Unassign from all nodes
    if (rolesCount > 0) {
      const updated = nodes.map((n) => ({
        ...n,
        assignedPeople: (n.assignedPeople ?? []).filter((u) => u !== uid),
      }));
      setNodes(updated);
      await syncNodes();
    }
    await removePerson(uid);
  }

  return (
    <div style={S.container}>
      <div style={S.inner}>
        <h2 style={S.h2}>People</h2>
        <p style={S.sub}>{people.length} people in this project</p>
        {people.length === 0 ? (
          <p style={S.empty}>No people yet. Add them via the Detail Panel when a node is selected.</p>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Last Name</th>
                <th style={S.th}>First Name</th>
                <th style={S.th}>Gender</th>
                <th style={S.th}>Hire Date</th>
                <th style={S.th}>Roles</th>
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.uid}>
                  <td style={{ ...S.td, fontWeight: 600 }}>{p.lastName || "—"}</td>
                  <td style={S.td}>{p.firstName || "—"}</td>
                  <td style={S.td}>{p.gender === "male" ? "M" : p.gender === "female" ? "F" : "—"}</td>
                  <td style={{ ...S.td, color: "var(--color-text-muted)" }}>{p.hireDate || "—"}</td>
                  <td style={{ ...S.td, color: "var(--color-accent)" }}>{getRoles(p.uid).join(", ") || "—"}</td>
                  <td style={{ ...S.td, textAlign: "right" }}>
                    <button
                      onClick={() => handleDelete(p.uid, `${p.firstName} ${p.lastName}`.trim())}
                      style={S.delBtn}
                      title="Delete person"
                    >✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  container: { height: "100%", overflow: "auto", padding: 32 },
  inner: { maxWidth: 900 },
  h2: { fontSize: 18, fontWeight: 700 },
  sub: { fontSize: 13, color: "var(--color-text-secondary)", marginTop: 4, marginBottom: 24 },
  empty: { color: "var(--color-text-muted)" },
  table: { width: "100%", borderCollapse: "collapse" as const },
  th: { textAlign: "left" as const, padding: "8px 12px", fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.05em", borderBottom: "1px solid var(--color-border)" },
  td: { padding: "10px 12px", fontSize: 13, borderBottom: "1px solid var(--color-border-subtle)" },
  delBtn: { width: 24, height: 24, borderRadius: "var(--radius-sm)", color: "var(--color-text-muted)", fontSize: 13, cursor: "pointer" },
};
