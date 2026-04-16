import { supabase } from "@/platform/supabase";
import type { Project, OrgNode, Relation, Person, VersionSnapshot, ProjectSettings } from "@/types/project";

// ── Helpers ──────────────────────────────────────────────────

function snakeToCamel(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camel] = value;
  }
  return result;
}

function camelToSnake(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip undefined values and timestamps (let Supabase manage them)
    if (value === undefined) continue;
    if (key === "createdAt" || key === "updatedAt") continue;
    const snake = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    result[snake] = value;
  }
  return result;
}

// ── PIN ──────────────────────────────────────────────────────

export async function verifyPin(pin: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "pin")
    .single();
  if (error || !data) return false;
  return data.value === pin;
}

// ── Projects ─────────────────────────────────────────────────

export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => snakeToCamel(r) as unknown as Project);
}

export async function fetchProject(id: string): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return snakeToCamel(data) as unknown as Project;
}

export async function createProject(name: string, settings?: Partial<ProjectSettings>): Promise<Project> {
  const defaultSettings: ProjectSettings = {
    languages: [
      { code: "it", label: "Italiano" },
      { code: "en", label: "English" },
      { code: "de", label: "Deutsch" },
    ],
    dominantLanguage: "it",
    tags: [],
  };
  const { data, error } = await supabase
    .from("projects")
    .insert({ name, settings: { ...defaultSettings, ...settings } })
    .select()
    .single();
  if (error) throw error;
  return snakeToCamel(data) as unknown as Project;
}

export async function updateProject(id: string, updates: Partial<{ name: string; settings: ProjectSettings }>): Promise<void> {
  const { error } = await supabase.from("projects").update(updates).eq("id", id);
  if (error) throw error;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}

// ── Nodes ────────────────────────────────────────────────────

export async function fetchNodes(projectId: string): Promise<OrgNode[]> {
  const { data, error } = await supabase
    .from("nodes")
    .select("*")
    .eq("project_id", projectId)
    .order("order");
  if (error) throw error;
  return (data ?? []).map((r) => snakeToCamel(r) as unknown as OrgNode);
}

export async function upsertNode(node: OrgNode): Promise<void> {
  const row = camelToSnake(node as unknown as Record<string, unknown>);
  const { error } = await supabase.from("nodes").upsert(row);
  if (error) throw error;
}

export async function upsertNodes(nodes: OrgNode[]): Promise<void> {
  if (nodes.length === 0) return;
  const rows = nodes.map((n) => camelToSnake(n as unknown as Record<string, unknown>));
  const { error } = await supabase.from("nodes").upsert(rows);
  if (error) throw error;
}

export async function deleteNode(nodeId: string): Promise<void> {
  const { error } = await supabase.from("nodes").delete().eq("id", nodeId);
  if (error) throw error;
}

export async function deleteNodesByProject(projectId: string): Promise<void> {
  const { error } = await supabase.from("nodes").delete().eq("project_id", projectId);
  if (error) throw error;
}

// ── Relations ────────────────────────────────────────────────

export async function fetchRelations(projectId: string): Promise<Relation[]> {
  const { data, error } = await supabase
    .from("relations")
    .select("*")
    .eq("project_id", projectId);
  if (error) throw error;
  return (data ?? []).map((r) => snakeToCamel(r) as unknown as Relation);
}

export async function upsertRelation(relation: Relation): Promise<void> {
  const row = camelToSnake(relation as unknown as Record<string, unknown>);
  const { error } = await supabase.from("relations").upsert(row);
  if (error) throw error;
}

export async function deleteRelation(relationId: string): Promise<void> {
  const { error } = await supabase.from("relations").delete().eq("id", relationId);
  if (error) throw error;
}

// ── People ───────────────────────────────────────────────────

export async function fetchPeople(projectId: string): Promise<Person[]> {
  const { data, error } = await supabase
    .from("people")
    .select("*")
    .eq("project_id", projectId)
    .order("last_name");
  if (error) throw error;
  return (data ?? []).map((r) => snakeToCamel(r) as unknown as Person);
}

export async function upsertPerson(person: Person): Promise<Person> {
  const row = camelToSnake(person as unknown as Record<string, unknown>);
  const { data, error } = await supabase.from("people").upsert(row).select().single();
  if (error) throw error;
  return snakeToCamel(data) as unknown as Person;
}

export async function deletePerson(uid: string): Promise<void> {
  const { error } = await supabase.from("people").delete().eq("uid", uid);
  if (error) throw error;
}

// ── Versions ─────────────────────────────────────────────────

export async function fetchVersions(projectId: string): Promise<VersionSnapshot[]> {
  const { data, error } = await supabase
    .from("versions")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => snakeToCamel(r) as unknown as VersionSnapshot);
}

export async function createVersion(version: { projectId: string; label: string; snapshot: unknown }): Promise<void> {
  const { error } = await supabase.from("versions").insert(camelToSnake(version as Record<string, unknown>));
  if (error) throw error;
}

export async function deleteVersionsAfter(projectId: string, createdAt: string): Promise<void> {
  const { error } = await supabase
    .from("versions")
    .delete()
    .eq("project_id", projectId)
    .gt("created_at", createdAt);
  if (error) throw error;
}
