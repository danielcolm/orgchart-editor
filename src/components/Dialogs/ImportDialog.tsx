import { useState, useRef } from "react";
import { useStore } from "@/store";
import { importFromExcel, type ImportResult } from "@/services/excelService";
import * as db from "@/services/dbService";

interface Props {
  onClose: () => void;
}

export function ImportDialog({ onClose }: Props) {
  const projectId = useStore((s) => s.projectId);
  const nodes = useStore((s) => s.nodes);
  const relations = useStore((s) => s.relations);
  const people = useStore((s) => s.people);
  const settings = useStore((s) => s.settings);
  const setNodes = useStore((s) => s.setNodes);
  const setRelations = useStore((s) => s.setRelations);
  const setPeople = useStore((s) => s.setPeople);
  const setSettings = useStore((s) => s.setSettings);
  const syncNodes = useStore((s) => s.syncNodes);
  const takeSnapshot = useStore((s) => s.takeSnapshot);

  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [applying, setApplying] = useState(false);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;
    setFileName(file.name);
    const buffer = await file.arrayBuffer();
    const r = importFromExcel(buffer, projectId, nodes, relations, people, settings.tags, settings.languages);
    setResult(r);
  }

  async function handleCommit() {
    if (!result || result.errors.length > 0 || !projectId) return;
    setApplying(true);
    try {
      await takeSnapshot("Import from Excel");

      // Update settings with new tags
      if (result.tags.length !== settings.tags.length) {
        setSettings({ ...settings, tags: result.tags });
      }

      // People
      const existingUids = new Set(people.map((p) => p.uid));
      for (const p of result.people) {
        if (!existingUids.has(p.uid) || p !== people.find((x) => x.uid === p.uid)) {
          await db.upsertPerson(p);
        }
      }
      setPeople(result.people);

      // Nodes
      setNodes(result.nodes);
      await db.upsertNodes(result.nodes);

      // Relations
      setRelations(result.relations);
      for (const r of result.relations) {
        await db.upsertRelation(r);
      }

      onClose();
    } catch (err) {
      alert(`Import failed: ${err}`);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.dialog} onClick={(e) => e.stopPropagation()}>
        <h3 style={S.title}>Import from Excel</h3>

        {!result ? (
          <>
            <p style={S.desc}>
              Select an .xlsx file to import. Must include sheets: Nodes, People (optional), Relations (optional), Tags (optional).
            </p>
            <input
              ref={fileRef} type="file" accept=".xlsx,.xls"
              onChange={handleFileSelect} style={S.fileInput}
            />
          </>
        ) : (
          <>
            <p style={S.fileName}>{fileName}</p>

            {result.errors.length > 0 && (
              <div style={S.errorSection}>
                <div style={S.errorTitle}>Errors ({result.errors.length}) — import blocked</div>
                {result.errors.map((err, i) => (
                  <div key={i} style={S.errorItem}>
                    {err.row > 0 && <span style={S.errorRow}>Row {err.row}</span>}
                    {err.column && <span style={S.errorCol}>{err.column}</span>}
                    <span>{err.message}</span>
                  </div>
                ))}
              </div>
            )}

            {result.warnings.length > 0 && (
              <div style={S.warnSection}>
                <div style={S.warnTitle}>Warnings ({result.warnings.length})</div>
                {result.warnings.map((w, i) => <div key={i} style={S.warnItem}>{w}</div>)}
              </div>
            )}

            {result.errors.length === 0 && (
              <div style={S.successSection}>
                <p>Ready to import: {result.nodes.length} nodes, {result.people.length} people, {result.relations.length} relations, {result.tags.length} tags.</p>
              </div>
            )}

            <div style={S.actions}>
              {result.errors.length === 0 && (
                <button onClick={handleCommit} disabled={applying} style={S.btnPrimary}>
                  {applying ? "Applying..." : "Apply Import"}
                </button>
              )}
              <button
                onClick={() => { setResult(null); if (fileRef.current) fileRef.current.value = ""; }}
                style={S.btnSecondary}
              >
                {result.errors.length > 0 ? "Try another file" : "Cancel"}
              </button>
            </div>
          </>
        )}

        <button onClick={onClose} style={S.closeBtn}>✕</button>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 },
  dialog: { background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: 24, width: 520, maxHeight: "80vh", overflow: "auto", position: "relative" },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 12 },
  desc: { fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 16 },
  fileName: { fontSize: 13, fontWeight: 600, marginBottom: 12 },
  fileInput: { marginBottom: 16, fontSize: 13 },
  errorSection: { background: "var(--color-danger-subtle)", borderRadius: "var(--radius-sm)", padding: 12, marginBottom: 12 },
  errorTitle: { fontSize: 12, fontWeight: 700, color: "var(--color-danger)", marginBottom: 8 },
  errorItem: { fontSize: 12, color: "var(--color-text)", padding: "4px 0", display: "flex", gap: 8, flexWrap: "wrap" as const },
  errorRow: { fontSize: 11, fontWeight: 600, color: "var(--color-danger)", background: "rgba(232,84,84,0.15)", padding: "1px 6px", borderRadius: "var(--radius-sm)" },
  errorCol: { fontSize: 11, fontWeight: 600, color: "var(--color-warning)", background: "rgba(240,168,64,0.15)", padding: "1px 6px", borderRadius: "var(--radius-sm)" },
  warnSection: { background: "rgba(240,168,64,0.1)", borderRadius: "var(--radius-sm)", padding: 12, marginBottom: 12 },
  warnTitle: { fontSize: 12, fontWeight: 700, color: "var(--color-warning)", marginBottom: 6 },
  warnItem: { fontSize: 12, color: "var(--color-text-secondary)", padding: "2px 0" },
  successSection: { background: "rgba(62,201,122,0.1)", borderRadius: "var(--radius-sm)", padding: 12, marginBottom: 12, fontSize: 13, color: "var(--color-success)" },
  actions: { display: "flex", gap: 8, marginTop: 16 },
  btnPrimary: { padding: "8px 20px", borderRadius: "var(--radius-sm)", background: "var(--color-accent)", color: "#fff", fontSize: 13, fontWeight: 600 },
  btnSecondary: { padding: "8px 20px", borderRadius: "var(--radius-sm)", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", color: "var(--color-text)", fontSize: 13 },
  closeBtn: { position: "absolute", top: 12, right: 12, fontSize: 16, color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer" },
};
