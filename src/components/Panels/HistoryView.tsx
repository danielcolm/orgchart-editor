import { useEffect, useState } from "react";
import { useStore } from "@/store";
import * as db from "@/services/dbService";
import type { VersionSnapshot } from "@/types/project";

export function HistoryView() {
  const projectId = useStore((s) => s.projectId);
  const setNodes = useStore((s) => s.setNodes);
  const setRelations = useStore((s) => s.setRelations);
  const setPeople = useStore((s) => s.setPeople);
  const nodes = useStore((s) => s.nodes);
  const relations = useStore((s) => s.relations);
  const people = useStore((s) => s.people);

  const [snapshots, setSnapshots] = useState<VersionSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    db.fetchVersions(projectId).then((v) => { setSnapshots(v); setLoading(false); });
  }, [projectId]);

  async function handleRollback(snap: VersionSnapshot) {
    if (!confirm(`Rollback to "${snap.label}"?\nThis will restore the state from that point.`)) return;
    const data = snap.snapshot as any;
    if (data.nodes) setNodes(data.nodes);
    if (data.relations) setRelations(data.relations);
    if (data.people) setPeople(data.people);
    // Sync to DB
    if (projectId && data.nodes) {
      await db.deleteNodesByProject(projectId);
      await db.upsertNodes(data.nodes);
    }
  }

  function formatTimeAgo(ts: string): string {
    const diff = Date.now() - new Date(ts).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  return (
    <div style={S.container}>
      <div style={S.inner}>
        <h2 style={S.h2}>Version History</h2>
        <p style={S.sub}>
          {snapshots.length} snapshot{snapshots.length !== 1 ? "s" : ""}
          {" · "}{nodes.length} nodes, {relations.length} relations, {people.length} people (current)
        </p>

        {loading ? <p style={S.empty}>Loading...</p> : snapshots.length === 0 ? (
          <p style={S.empty}>No snapshots yet. They are created automatically before each change.</p>
        ) : (
          <div style={S.list}>
            <div style={S.currentMarker}>
              <div style={S.currentDot} />
              <span style={S.currentLabel}>Current state</span>
            </div>
            {snapshots.map((snap) => (
              <div key={snap.id} style={S.snapItem}>
                <div style={S.snapDot} />
                <div style={S.snapContent}>
                  <div style={S.snapHeader}>
                    <span style={S.snapLabel}>{snap.label}</span>
                    <span style={S.snapTime}>{formatTimeAgo(snap.createdAt)}</span>
                  </div>
                </div>
                <button onClick={() => handleRollback(snap)} style={S.rollbackBtn}>Restore</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  container: { height: "100%", overflow: "auto", padding: 32 },
  inner: { maxWidth: 600 },
  h2: { fontSize: 18, fontWeight: 700 },
  sub: { fontSize: 13, color: "var(--color-text-secondary)", marginTop: 4, marginBottom: 24 },
  empty: { color: "var(--color-text-muted)", fontSize: 13 },
  list: { position: "relative" as const, paddingLeft: 20, borderLeft: "2px solid var(--color-border-subtle)" },
  currentMarker: { display: "flex", alignItems: "center", gap: 10, padding: "10px 0", marginLeft: -27, marginBottom: 8 },
  currentDot: { width: 12, height: 12, borderRadius: "50%", background: "var(--color-accent)", border: "2px solid var(--color-bg)", flexShrink: 0 },
  currentLabel: { fontSize: 13, fontWeight: 700, color: "var(--color-accent)" },
  snapItem: { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", marginLeft: -25 },
  snapDot: { width: 8, height: 8, borderRadius: "50%", background: "var(--color-border)", border: "2px solid var(--color-bg)", flexShrink: 0 },
  snapContent: { flex: 1, minWidth: 0 },
  snapHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  snapLabel: { fontSize: 13, fontWeight: 600, color: "var(--color-text)" },
  snapTime: { fontSize: 11, color: "var(--color-text-muted)", flexShrink: 0 },
  rollbackBtn: { padding: "4px 12px", borderRadius: "var(--radius-sm)", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)", fontSize: 11, fontWeight: 600, flexShrink: 0 },
};
