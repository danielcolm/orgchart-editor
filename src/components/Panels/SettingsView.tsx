import { useState } from "react";
import { useStore } from "@/store";
import type { Language, Tag } from "@/types/project";

const PRESET_COLORS = [
  "#e85454", "#f0a840", "#f8d447", "#3ec97a",
  "#4e8fff", "#a78bfa", "#ec4899", "#14b8a6",
];

export function SettingsView() {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const activeLanguage = useStore((s) => s.activeLanguage);
  const setActiveLanguage = useStore((s) => s.setActiveLanguage);

  const [newLangCode, setNewLangCode] = useState("");
  const [newLangLabel, setNewLangLabel] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0]);

  function addLanguage() {
    const code = newLangCode.trim().toLowerCase();
    const label = newLangLabel.trim();
    if (!code || !label) return;
    if (settings.languages.some((l) => l.code === code)) {
      alert(`Language "${code}" already exists`);
      return;
    }
    const newLang: Language = { code, label };
    setSettings({ ...settings, languages: [...settings.languages, newLang] });
    setNewLangCode("");
    setNewLangLabel("");
  }

  function removeLanguage(code: string) {
    if (settings.languages.length <= 1) {
      alert("Cannot remove the last language");
      return;
    }
    if (settings.dominantLanguage === code) {
      alert("Cannot remove the dominant language. Set another as dominant first.");
      return;
    }
    if (!confirm(`Remove language "${code}"? Translations in this language will remain in the database but won't be shown.`)) return;
    const newLangs = settings.languages.filter((l) => l.code !== code);
    setSettings({ ...settings, languages: newLangs });
    if (activeLanguage === code) {
      setActiveLanguage(settings.dominantLanguage);
    }
  }

  function setDominant(code: string) {
    setSettings({ ...settings, dominantLanguage: code });
  }

  function addTag() {
    const name = newTagName.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/\s+/g, "-");
    if (settings.tags.some((t) => t.id === id)) {
      alert(`Tag "${name}" already exists`);
      return;
    }
    const newTag: Tag = { id, name, color: newTagColor };
    setSettings({ ...settings, tags: [...settings.tags, newTag] });
    setNewTagName("");
    setNewTagColor(PRESET_COLORS[0]);
  }

  function removeTag(id: string) {
    if (!confirm("Remove this tag? Nodes that use it will lose the tag.")) return;
    setSettings({ ...settings, tags: settings.tags.filter((t) => t.id !== id) });
  }

  function updateTagColor(id: string, color: string) {
    setSettings({
      ...settings,
      tags: settings.tags.map((t) => t.id === id ? { ...t, color } : t),
    });
  }

  return (
    <div style={S.container}>
      <div style={S.inner}>
        <h2 style={S.h2}>Project Settings</h2>

        {/* Languages */}
        <section style={S.section}>
          <h3 style={S.h3}>Languages</h3>
          <p style={S.sub}>Configure which languages are available for translations.</p>

          <div style={S.list}>
            {settings.languages.map((lang) => (
              <div key={lang.code} style={S.row}>
                <span style={S.code}>{lang.code.toUpperCase()}</span>
                <span style={S.label}>{lang.label}</span>
                {settings.dominantLanguage === lang.code ? (
                  <span style={S.dominantBadge}>Dominant</span>
                ) : (
                  <button onClick={() => setDominant(lang.code)} style={S.smallBtn}>Set dominant</button>
                )}
                <button onClick={() => removeLanguage(lang.code)} style={S.removeBtn}>✕</button>
              </div>
            ))}
          </div>

          <div style={S.addRow}>
            <input
              placeholder="Code (e.g. fr)"
              value={newLangCode}
              onChange={(e) => setNewLangCode(e.target.value)}
              style={{ ...S.input, width: 100 }}
              maxLength={5}
            />
            <input
              placeholder="Label (e.g. Français)"
              value={newLangLabel}
              onChange={(e) => setNewLangLabel(e.target.value)}
              style={{ ...S.input, flex: 1 }}
            />
            <button onClick={addLanguage} style={S.addBtn}>Add Language</button>
          </div>
        </section>

        {/* Tags */}
        <section style={S.section}>
          <h3 style={S.h3}>Tags</h3>
          <p style={S.sub}>Custom tags for nodes. Multiple tags can be applied to a node. Tags are not translated.</p>

          {settings.tags.length === 0 && <p style={S.empty}>No tags defined yet.</p>}
          <div style={S.list}>
            {settings.tags.map((tag) => (
              <div key={tag.id} style={S.row}>
                <div style={{ ...S.tagBadge, background: tag.color }}>{tag.name}</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => updateTagColor(tag.id, color)}
                      style={{
                        width: 16, height: 16, borderRadius: "50%",
                        background: color, cursor: "pointer",
                        border: tag.color === color ? "2px solid var(--color-text)" : "2px solid transparent",
                      }}
                    />
                  ))}
                </div>
                <button onClick={() => removeTag(tag.id)} style={S.removeBtn}>✕</button>
              </div>
            ))}
          </div>

          <div style={S.addRow}>
            <input
              placeholder="Tag name (e.g. Critical)"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              style={{ ...S.input, flex: 1 }}
            />
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setNewTagColor(color)}
                  style={{
                    width: 20, height: 20, borderRadius: "50%",
                    background: color, cursor: "pointer",
                    border: newTagColor === color ? "2px solid var(--color-text)" : "2px solid transparent",
                  }}
                />
              ))}
            </div>
            <button onClick={addTag} style={S.addBtn}>Add Tag</button>
          </div>
        </section>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  container: { height: "100%", overflow: "auto", padding: 32 },
  inner: { maxWidth: 720 },
  h2: { fontSize: 18, fontWeight: 700, marginBottom: 24 },
  section: { marginBottom: 40, paddingBottom: 24, borderBottom: "1px solid var(--color-border-subtle)" },
  h3: { fontSize: 14, fontWeight: 700, marginBottom: 4 },
  sub: { fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 16 },
  empty: { fontSize: 13, color: "var(--color-text-muted)", fontStyle: "italic", marginBottom: 12 },
  list: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 },
  row: { display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: "var(--radius-sm)", background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)" },
  code: { fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "var(--color-bg)", color: "var(--color-text-secondary)", letterSpacing: "0.05em", minWidth: 40, textAlign: "center" as const },
  label: { fontSize: 13, fontWeight: 500, flex: 1 },
  dominantBadge: { fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 8, background: "var(--color-accent-subtle)", color: "var(--color-accent)", textTransform: "uppercase" as const, letterSpacing: "0.04em" },
  smallBtn: { fontSize: 11, padding: "4px 8px", borderRadius: "var(--radius-sm)", background: "var(--color-bg)", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)" },
  removeBtn: { fontSize: 13, color: "var(--color-text-muted)", padding: "4px 8px" },
  tagBadge: { fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 10, color: "#fff", flex: 1, maxWidth: 150 },
  addRow: { display: "flex", gap: 8, alignItems: "center", marginTop: 8 },
  input: { padding: "6px 10px", borderRadius: "var(--radius-sm)", background: "var(--color-bg)", border: "1px solid var(--color-border)", color: "var(--color-text)", fontSize: 13 },
  addBtn: { padding: "6px 14px", borderRadius: "var(--radius-sm)", background: "var(--color-accent)", color: "#fff", fontSize: 12, fontWeight: 600 },
};
