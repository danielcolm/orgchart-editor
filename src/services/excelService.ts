import * as XLSX from "xlsx";
import type { OrgNode, Relation, Person, ProjectSettings, Tag, TranslationEntry } from "@/types/project";

// ── Export ────────────────────────────────────────────────────

export function exportToExcel(
  projectName: string,
  settings: ProjectSettings,
  nodes: OrgNode[],
  relations: Relation[],
  people: Person[],
  filename: string = "orgchart.xlsx"
): void {
  const langs = settings.languages;
  const wb = XLSX.utils.book_new();

  // ── Nodes sheet ──
  const nodeRows = nodes
    .sort((a, b) => {
      const dA = getDepth(nodes, a.id);
      const dB = getDepth(nodes, b.id);
      if (dA !== dB) return dA - dB;
      return a.order - b.order;
    })
    .map((node) => {
      const row: Record<string, string | number> = {
        ID: node.id,
        ParentID: node.parentId ?? "",
        IsStaff: node.isStaff ? "yes" : "no",
        Order: node.order,
        StaffLayout: node.staffLayout,
        ChildrenLayout: node.childrenLayout,
        AssignedPeople: (node.assignedPeople ?? []).join(", "),
        Tags: (node.tags ?? []).join(", "),
        Note: node.note ?? "",
      };
      for (const lang of langs) {
        const t = node.translations[lang.code];
        const up = lang.code.toUpperCase();
        row[`Name_${up}`] = t?.name ?? "";
        row[`Description_${up}`] = t?.description ?? "";
        row[`Mandate_${up}`] = t?.mandate ?? "";
        row[`Responsibility_${up}`] = t?.responsibility ?? "";
        row[`Authority_${up}`] = t?.authority ?? "";
        row[`Tasks_${up}`] = t?.tasks ?? "";
        row[`KPI_${up}`] = t?.kpi ?? "";
      }
      return row;
    });

  const nodesSheet = XLSX.utils.json_to_sheet(nodeRows);
  if (nodeRows.length > 0) {
    nodesSheet["!cols"] = Object.keys(nodeRows[0]).map((k) => ({ wch: Math.max(k.length, 18) }));
  }
  XLSX.utils.book_append_sheet(wb, nodesSheet, "Nodes");

  // ── People sheet ──
  const peopleRows = people.map((p) => ({
    UID: p.uid,
    FirstName: p.firstName,
    LastName: p.lastName,
    Gender: p.gender ?? "",
    BirthDate: p.birthDate ?? "",
    HireDate: p.hireDate ?? "",
  }));
  const peopleSheet = XLSX.utils.json_to_sheet(peopleRows);
  if (peopleRows.length > 0) {
    peopleSheet["!cols"] = Object.keys(peopleRows[0]).map(() => ({ wch: 20 }));
  }
  XLSX.utils.book_append_sheet(wb, peopleSheet, "People");

  // ── Relations sheet ──
  if (relations.length > 0) {
    const relRows = relations.map((r) => {
      const row: Record<string, string> = {
        ID: r.id,
        Source: r.sourceId,
        Target: r.targetId,
      };
      for (const lang of langs) {
        row[`Label_${lang.code.toUpperCase()}`] = r.translations[lang.code]?.label ?? "";
      }
      return row;
    });
    const relSheet = XLSX.utils.json_to_sheet(relRows);
    XLSX.utils.book_append_sheet(wb, relSheet, "Relations");
  }

  // ── Tags sheet ──
  if (settings.tags.length > 0) {
    const tagRows = settings.tags.map((t) => ({ ID: t.id, Name: t.name, Color: t.color }));
    const tagSheet = XLSX.utils.json_to_sheet(tagRows);
    XLSX.utils.book_append_sheet(wb, tagSheet, "Tags");
  }

  XLSX.writeFile(wb, filename);
}

function getDepth(nodes: OrgNode[], nodeId: string): number {
  let depth = 0;
  let current = nodes.find((n) => n.id === nodeId);
  while (current?.parentId) {
    depth++;
    current = nodes.find((n) => n.id === current!.parentId);
  }
  return depth;
}

// ── Import ────────────────────────────────────────────────────

export interface ImportError {
  row: number;
  column: string;
  message: string;
}

export interface ImportResult {
  nodes: OrgNode[];
  relations: Relation[];
  people: Person[];
  tags: Tag[];
  errors: ImportError[];
  warnings: string[];
}

export function importFromExcel(
  file: ArrayBuffer,
  projectId: string,
  existingNodes: OrgNode[],
  existingRelations: Relation[],
  existingPeople: Person[],
  existingTags: Tag[],
  languages: { code: string; label: string }[]
): ImportResult {
  const errors: ImportError[] = [];
  const warnings: string[] = [];

  const wb = XLSX.read(file, { type: "array" });

  // ── Parse Tags sheet (first, so nodes can reference them) ──
  let resultTags = [...existingTags];
  const tagSheetName = wb.SheetNames.find((s) => s.toLowerCase() === "tags");
  if (tagSheetName) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[tagSheetName]);
    for (const row of rows) {
      const id = String(row["ID"] ?? "").trim();
      const name = String(row["Name"] ?? "").trim();
      const color = String(row["Color"] ?? "#4e8fff").trim();
      if (!id || !name) continue;
      const idx = resultTags.findIndex((t) => t.id === id);
      if (idx >= 0) resultTags[idx] = { id, name, color };
      else resultTags.push({ id, name, color });
    }
  }

  // ── Parse People sheet ──
  let resultPeople = [...existingPeople];
  const peopleSheetName = wb.SheetNames.find((s) => s.toLowerCase() === "people");
  if (peopleSheetName) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[peopleSheetName]);
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      const uid = String(row["UID"] ?? "").trim() || crypto.randomUUID();
      const firstName = String(row["FirstName"] ?? "").trim();
      const lastName = String(row["LastName"] ?? "").trim();
      const genderStr = String(row["Gender"] ?? "").trim().toLowerCase();
      const gender: Person["gender"] = genderStr === "male" || genderStr === "m" ? "male"
        : genderStr === "female" || genderStr === "f" ? "female" : null;
      const birthDate = String(row["BirthDate"] ?? "").trim() || null;
      const hireDate = String(row["HireDate"] ?? "").trim() || null;

      if (!firstName && !lastName) {
        errors.push({ row: rowNum, column: "FirstName/LastName", message: "Person must have at least a first or last name" });
        continue;
      }

      const person: Person = { uid, projectId, firstName, lastName, gender, birthDate, hireDate };
      const idx = resultPeople.findIndex((p) => p.uid === uid);
      if (idx >= 0) resultPeople[idx] = person;
      else resultPeople.push(person);
    }
  }

  // ── Parse Nodes sheet ──
  const nodesSheetName = wb.SheetNames.find((s) => s.toLowerCase() === "nodes");
  if (!nodesSheetName) {
    errors.push({ row: 0, column: "", message: 'Sheet "Nodes" not found' });
    return { nodes: existingNodes, relations: existingRelations, people: existingPeople, tags: existingTags, errors, warnings };
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[nodesSheetName]);
  const existingIdSet = new Set(existingNodes.map((n) => n.id));
  const resultNodes = new Map(existingNodes.map((n) => [n.id, { ...n }]));
  const newIdMap = new Map<string, string>();
  const personUidSet = new Set(resultPeople.map((p) => p.uid));
  const tagIdSet = new Set(resultTags.map((t) => t.id));

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const rowNum = i + 2;
    const rawId = String(row["ID"] ?? "").trim();
    const rawParentId = String(row["ParentID"] ?? "").trim();
    const isStaff = String(row["IsStaff"] ?? "no").toLowerCase() === "yes";
    const order = Number(row["Order"] ?? 0);
    const staffLayout = (String(row["StaffLayout"] ?? "horizontal").toLowerCase() === "vertical" ? "vertical" : "horizontal") as "horizontal" | "vertical";
    const childrenLayout = (String(row["ChildrenLayout"] ?? "horizontal").toLowerCase() === "vertical" ? "vertical" : "horizontal") as "horizontal" | "vertical";
    const note = String(row["Note"] ?? "");
    const assignedPeopleStr = String(row["AssignedPeople"] ?? "").trim();
    const tagsStr = String(row["Tags"] ?? "").trim();

    const assignedPeople = assignedPeopleStr
      ? assignedPeopleStr.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    const tags = tagsStr
      ? tagsStr.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    // Validate person UIDs
    for (const uid of assignedPeople) {
      if (!personUidSet.has(uid)) {
        warnings.push(`Row ${rowNum}: unknown person UID "${uid}" (skipped)`);
      }
    }
    const validAssigned = assignedPeople.filter((uid) => personUidSet.has(uid));

    // Validate tag IDs
    for (const tid of tags) {
      if (!tagIdSet.has(tid)) {
        warnings.push(`Row ${rowNum}: unknown tag "${tid}" (skipped)`);
      }
    }
    const validTags = tags.filter((tid) => tagIdSet.has(tid));

    let nodeId: string;
    if (rawId === "") {
      nodeId = crypto.randomUUID();
      newIdMap.set(String(i), nodeId);
    } else if (existingIdSet.has(rawId)) {
      nodeId = rawId;
    } else {
      errors.push({ row: rowNum, column: "ID", message: `Unknown ID "${rawId}". Use empty for new nodes.` });
      continue;
    }

    let parentId: string | null = null;
    if (rawParentId !== "") {
      if (existingIdSet.has(rawParentId)) {
        parentId = rawParentId;
      } else {
        const found = [...newIdMap.entries()].find(([, id]) => id === rawParentId);
        if (found) {
          parentId = rawParentId;
        } else {
          errors.push({ row: rowNum, column: "ParentID", message: `Unknown ParentID "${rawParentId}".` });
          continue;
        }
      }
    }

    const translations: Record<string, TranslationEntry> = {};
    const now = Date.now();
    for (const lang of languages) {
      const up = lang.code.toUpperCase();
      const name = String(row[`Name_${up}`] ?? "");
      const description = String(row[`Description_${up}`] ?? "");
      const mandate = String(row[`Mandate_${up}`] ?? "");
      const responsibility = String(row[`Responsibility_${up}`] ?? "");
      const authority = String(row[`Authority_${up}`] ?? "");
      const tasks = String(row[`Tasks_${up}`] ?? "");
      const kpi = String(row[`KPI_${up}`] ?? "");
      if (name || description || mandate || responsibility || authority || tasks || kpi) {
        translations[lang.code] = { name, description, mandate, responsibility, authority, tasks, kpi, updatedAt: now };
      }
    }

    const existing = resultNodes.get(nodeId);
    const node: OrgNode = {
      id: nodeId,
      projectId,
      parentId,
      isStaff,
      order,
      staffLayout,
      childrenLayout,
      assignedPeople: validAssigned,
      tags: validTags,
      note,
      translations: { ...(existing?.translations ?? {}), ...translations },
    };

    resultNodes.set(nodeId, node);
    existingIdSet.add(nodeId);
  }

  // ── Parse Relations sheet ──
  let resultRelations = [...existingRelations];
  const relSheetName = wb.SheetNames.find((s) => s.toLowerCase() === "relations");
  if (relSheetName) {
    const relRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[relSheetName]);
    for (let i = 0; i < relRows.length; i++) {
      const row = relRows[i];
      const rowNum = i + 2;
      const id = String(row["ID"] ?? "").trim() || crypto.randomUUID();
      const source = String(row["Source"] ?? "").trim();
      const target = String(row["Target"] ?? "").trim();
      if (!source || !target) {
        errors.push({ row: rowNum, column: "Source/Target", message: "Both required" });
        continue;
      }
      if (!existingIdSet.has(source) || !existingIdSet.has(target)) {
        errors.push({ row: rowNum, column: "Source/Target", message: `Unknown node reference` });
        continue;
      }
      const translations: Record<string, { label: string; updatedAt: number }> = {};
      const now = Date.now();
      for (const lang of languages) {
        const label = String(row[`Label_${lang.code.toUpperCase()}`] ?? "");
        translations[lang.code] = { label, updatedAt: now };
      }
      const rel: Relation = { id, projectId, sourceId: source, targetId: target, translations };
      const idx = resultRelations.findIndex((r) => r.id === id);
      if (idx >= 0) resultRelations[idx] = rel;
      else resultRelations.push(rel);
    }
  }

  // Cycle detection
  const nodeArray = Array.from(resultNodes.values());
  if (hasCycle(nodeArray)) {
    errors.push({ row: 0, column: "", message: "Import would create a hierarchy cycle. Aborted." });
    return { nodes: existingNodes, relations: existingRelations, people: existingPeople, tags: existingTags, errors, warnings };
  }

  if (errors.length > 0) {
    return { nodes: existingNodes, relations: existingRelations, people: existingPeople, tags: existingTags, errors, warnings };
  }

  return { nodes: nodeArray, relations: resultRelations, people: resultPeople, tags: resultTags, errors: [], warnings };
}

function hasCycle(nodes: OrgNode[]): boolean {
  const visited = new Set<string>();
  const inStack = new Set<string>();
  function dfs(id: string): boolean {
    if (inStack.has(id)) return true;
    if (visited.has(id)) return false;
    visited.add(id);
    inStack.add(id);
    for (const child of nodes.filter((n) => n.parentId === id)) {
      if (dfs(child.id)) return true;
    }
    inStack.delete(id);
    return false;
  }
  for (const n of nodes) {
    if (!visited.has(n.id) && dfs(n.id)) return true;
  }
  return false;
}
