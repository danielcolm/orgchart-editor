import { create } from "zustand";
import type { Project, OrgNode, Relation, Person, ProjectSettings, Language, Tag } from "@/types/project";
import type { ContextMenuState, ViewMode, ThemeMode } from "@/types/ui";
import * as db from "@/services/dbService";

interface AppStore {
  // Auth
  authenticated: boolean;
  setAuthenticated: (v: boolean) => void;

  // Theme
  theme: ThemeMode;
  toggleTheme: () => void;

  // Project list
  projects: Project[];
  loadProjects: () => Promise<void>;

  // Active project
  projectId: string | null;
  projectName: string;
  settings: ProjectSettings;
  nodes: OrgNode[];
  relations: Relation[];
  people: Person[];

  // UI
  activeLanguage: string;
  selectedNodeId: string | null;
  contextMenu: ContextMenuState;
  collapsedNodes: Set<string>;
  focusNodeId: string | null;
  focusWithParents: boolean;
  viewMode: ViewMode;
  editingNodeId: string | null;
  showNames: boolean;
  collapseAfterLevel: number | null;

  // Actions — project
  openProject: (id: string) => Promise<void>;
  setProjectName: (name: string) => void;
  setSettings: (settings: ProjectSettings) => void;

  // Actions — language
  setActiveLanguage: (lang: string) => void;

  // Actions — nodes
  setNodes: (nodes: OrgNode[]) => void;
  syncNodes: () => Promise<void>;

  // Actions — relations
  setRelations: (relations: Relation[]) => void;
  syncRelations: () => Promise<void>;

  // Actions — people
  setPeople: (people: Person[]) => void;
  addPerson: (person: Person) => Promise<Person>;
  removePerson: (uid: string) => Promise<void>;

  // Actions — UI
  selectNode: (id: string | null) => void;
  showContextMenu: (x: number, y: number, nodeId: string) => void;
  hideContextMenu: () => void;
  toggleCollapse: (id: string) => void;
  setFocus: (id: string | null, withParents?: boolean) => void;
  resetView: () => void;
  setViewMode: (mode: ViewMode) => void;
  setEditingNodeId: (id: string | null) => void;
  toggleShowNames: () => void;
  setCollapseAfterLevel: (level: number | null) => void;

  // Snapshot
  takeSnapshot: (label: string) => Promise<void>;
}

export const useStore = create<AppStore>((set, get) => ({
  // Auth
  authenticated: false,
  setAuthenticated: (v) => set({ authenticated: v }),

  // Theme
  theme: (localStorage.getItem("orgchart-theme") as ThemeMode) ?? "dark",
  toggleTheme: () => {
    const next = get().theme === "dark" ? "light" : "dark";
    localStorage.setItem("orgchart-theme", next);
    set({ theme: next });
  },

  // Project list
  projects: [],
  loadProjects: async () => {
    const projects = await db.fetchProjects();
    set({ projects });
  },

  // Active project
  projectId: null,
  projectName: "",
  settings: {
    languages: [{ code: "it", label: "Italiano" }, { code: "en", label: "English" }, { code: "de", label: "Deutsch" }],
    dominantLanguage: "it",
    tags: [],
  },
  nodes: [],
  relations: [],
  people: [],

  openProject: async (id) => {
    const [project, nodes, relations, people] = await Promise.all([
      db.fetchProject(id),
      db.fetchNodes(id),
      db.fetchRelations(id),
      db.fetchPeople(id),
    ]);
    set({
      projectId: project.id,
      projectName: project.name,
      settings: project.settings,
      nodes,
      relations,
      people,
      activeLanguage: project.settings.dominantLanguage,
      selectedNodeId: null,
      contextMenu: { visible: false, x: 0, y: 0, nodeId: null },
      collapsedNodes: new Set(),
      focusNodeId: null,
      focusWithParents: false,
      viewMode: "graph",
      editingNodeId: null,
      collapseAfterLevel: null,
    });
  },

  setProjectName: (name) => {
    set({ projectName: name });
    const id = get().projectId;
    if (id) db.updateProject(id, { name });
  },

  setSettings: (settings) => {
    set({ settings });
    const id = get().projectId;
    if (id) db.updateProject(id, { settings });
  },

  // Language
  activeLanguage: "it",
  setActiveLanguage: (lang) => set({ activeLanguage: lang }),

  // Nodes
  setNodes: (nodes) => set({ nodes }),
  syncNodes: async () => {
    const { nodes, projectId } = get();
    if (!projectId) return;
    await db.upsertNodes(nodes);
  },

  // Relations
  setRelations: (relations) => set({ relations }),
  syncRelations: async () => {
    const { relations } = get();
    for (const r of relations) {
      await db.upsertRelation(r);
    }
  },

  // People
  setPeople: (people) => set({ people }),
  addPerson: async (person) => {
    const saved = await db.upsertPerson(person);
    set((s) => ({ people: [...s.people, saved] }));
    return saved;
  },
  removePerson: async (uid) => {
    await db.deletePerson(uid);
    set((s) => ({ people: s.people.filter((p) => p.uid !== uid) }));
  },

  // UI
  selectedNodeId: null,
  contextMenu: { visible: false, x: 0, y: 0, nodeId: null },
  collapsedNodes: new Set(),
  focusNodeId: null,
  focusWithParents: false,
  viewMode: "graph",
  editingNodeId: null,
  showNames: true,
  collapseAfterLevel: null,

  selectNode: (id) => set({ selectedNodeId: id }),
  showContextMenu: (x, y, nodeId) =>
    set({ contextMenu: { visible: true, x, y, nodeId } }),
  hideContextMenu: () =>
    set({ contextMenu: { visible: false, x: 0, y: 0, nodeId: null } }),
  toggleCollapse: (id) =>
    set((s) => {
      const next = new Set(s.collapsedNodes);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { collapsedNodes: next };
    }),
  setFocus: (id, withParents) => set({ focusNodeId: id, focusWithParents: withParents ?? false }),
  resetView: () =>
    set({ collapsedNodes: new Set(), focusNodeId: null, focusWithParents: false, collapseAfterLevel: null }),
  setCollapseAfterLevel: (level) => set({ collapseAfterLevel: level }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setEditingNodeId: (id) => set({ editingNodeId: id }),
  toggleShowNames: () => set((s) => ({ showNames: !s.showNames })),

  // Snapshot
  takeSnapshot: async (label) => {
    const { projectId, nodes, relations, people } = get();
    if (!projectId) return;
    await db.createVersion({
      projectId,
      label,
      snapshot: { nodes, relations, people },
    });
  },
}));
