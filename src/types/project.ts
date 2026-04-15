// ── Layout ───────────────────────────────────────────────────
export type LayoutMode = "horizontal" | "vertical";

// ── Translation ──────────────────────────────────────────────
export interface TranslationEntry {
  name: string;
  description: string;
  mandate: string;
  responsibility: string;
  authority: string;
  tasks: string;
  kpi: string;
  updatedAt: number;
}

export interface RelationTranslationEntry {
  label: string;
  updatedAt: number;
}

// ── Person (language-independent) ────────────────────────────
export interface Person {
  uid: string;
  projectId: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  hireDate: string | null;
  gender: "male" | "female" | null;
}

// ── Node (= Role) ───────────────────────────────────────────
export interface OrgNode {
  id: string;
  projectId: string;
  parentId: string | null;
  isStaff: boolean;
  order: number;
  staffLayout: LayoutMode;
  childrenLayout: LayoutMode;
  assignedPeople: string[]; // Person UIDs
  tags: string[];           // Tag IDs
  note: string;
  translations: Record<string, TranslationEntry>;
}

// ── Relation ─────────────────────────────────────────────────
export interface Relation {
  id: string;
  projectId: string;
  sourceId: string;
  targetId: string;
  translations: Record<string, RelationTranslationEntry>;
}

// ── Tag ──────────────────────────────────────────────────────
export interface Tag {
  id: string;
  name: string;
  color: string;
}

// ── Language ─────────────────────────────────────────────────
export interface Language {
  code: string;
  label: string;
}

// ── Project ──────────────────────────────────────────────────
export interface ProjectSettings {
  languages: Language[];
  dominantLanguage: string;
  tags: Tag[];
}

export interface Project {
  id: string;
  name: string;
  settings: ProjectSettings;
  createdAt: string;
  updatedAt: string;
}

// ── Version ──────────────────────────────────────────────────
export interface VersionSnapshot {
  id: string;
  projectId: string;
  label: string;
  snapshot: {
    nodes: OrgNode[];
    relations: Relation[];
    people: Person[];
  };
  createdAt: string;
}
