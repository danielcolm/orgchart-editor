import { useEffect, useCallback } from "react";
import { useStore } from "@/store";
import { wouldCreateCycle } from "@/utils/cycleDetector";

export function NodeContextMenu() {
  const ctx = useStore((s) => s.contextMenu);
  const hide = useStore((s) => s.hideContextMenu);
  const nodes = useStore((s) => s.nodes);
  const setNodes = useStore((s) => s.setNodes);
  const syncNodes = useStore((s) => s.syncNodes);
  const relations = useStore((s) => s.relations);
  const setRelations = useStore((s) => s.setRelations);
  const settings = useStore((s) => s.settings);
  const activeLanguage = useStore((s) => s.activeLanguage);
  const setEditingNodeId = useStore((s) => s.setEditingNodeId);
  const selectNode = useStore((s) => s.selectNode);
  const toggleCollapse = useStore((s) => s.toggleCollapse);
  const collapsedNodes = useStore((s) => s.collapsedNodes);
  const setFocus = useStore((s) => s.setFocus);
  const focusNodeId = useStore((s) => s.focusNodeId);
  const resetView = useStore((s) => s.resetView);
  const takeSnapshot = useStore((s) => s.takeSnapshot);

  const node = nodes.find((n) => n.id === ctx.nodeId);

  useEffect(() => {
    if (!ctx.visible) return;
    const h = () => hide();
    window.addEventListener("click", h);
    return () => window.removeEventListener("click", h);
  }, [ctx.visible, hide]);

  const act = useCallback((fn: () => void, label?: string) => {
    if (label) takeSnapshot(label);
    fn();
    hide();
  }, [hide, takeSnapshot]);

  if (!ctx.visible || !ctx.nodeId || !node) return null;

  const isRoot = node.parentId === null;
  const hasChildren = nodes.some((n) => n.parentId === ctx.nodeId);
  const hasStaffChildren = nodes.some((n) => n.parentId === ctx.nodeId && n.isStaff);
  const hasRegularChildren = nodes.some((n) => n.parentId === ctx.nodeId && !n.isStaff);
  const nodeRelations = relations.filter((r) => r.sourceId === ctx.nodeId || r.targetId === ctx.nodeId);

  return (
    <div className="context-menu" style={{ left: ctx.x, top: ctx.y }} onClick={(e) => e.stopPropagation()}>
      <button className="context-menu__item" onClick={() => act(() => {
        const name = prompt("Node name:");
        if (!name?.trim()) return;
        const now = Date.now();
        const translations: Record<string, unknown> = {};
        for (const lang of settings.languages) {
          translations[lang.code] = { name: name.trim(), description: "", mandate: "", responsibility: "", authority: "", tasks: "", kpi: "", updatedAt: lang.code === activeLanguage ? now : now - 1 };
        }
        const siblings = nodes.filter((n) => n.parentId === ctx.nodeId && !n.isStaff);
        setNodes([...nodes, {
          id: crypto.randomUUID(), projectId: nodes[0]?.projectId ?? "", parentId: ctx.nodeId!, isStaff: false,
          order: siblings.length, staffLayout: "horizontal", childrenLayout: "horizontal",
          assignedPeople: [], tags: [], note: "", translations: translations as any,
        }]);
        syncNodes();
      }, "Add child")}>Add child</button>

      {!isRoot && <button className="context-menu__item" onClick={() => act(() => {
        const name = prompt("Node name:");
        if (!name?.trim()) return;
        const now = Date.now();
        const translations: Record<string, unknown> = {};
        for (const lang of settings.languages) {
          translations[lang.code] = { name: name.trim(), description: "", mandate: "", responsibility: "", authority: "", tasks: "", kpi: "", updatedAt: lang.code === activeLanguage ? now : now - 1 };
        }
        const siblings = nodes.filter((n) => n.parentId === node.parentId && !n.isStaff);
        setNodes([...nodes, {
          id: crypto.randomUUID(), projectId: nodes[0]?.projectId ?? "", parentId: node.parentId!, isStaff: false,
          order: siblings.length, staffLayout: "horizontal", childrenLayout: "horizontal",
          assignedPeople: [], tags: [], note: "", translations: translations as any,
        }]);
        syncNodes();
      }, "Add sibling")}>Add sibling</button>}

      <div className="context-menu__separator" />

      <button className="context-menu__item" onClick={() => act(() => setEditingNodeId(ctx.nodeId))}>Rename</button>
      <button className="context-menu__item" onClick={() => act(() => selectNode(ctx.nodeId!))}>Details</button>

      {!isRoot && <button className="context-menu__item" onClick={() => act(() => {
        setNodes(nodes.map((n) => n.id === ctx.nodeId ? { ...n, isStaff: !n.isStaff } : n));
        syncNodes();
      }, "Toggle staff")}>{node.isStaff ? "Make regular child" : "Make staff"}</button>}

      <button className="context-menu__item" onClick={() => {
        const otherNodes = nodes.filter((n) => n.id !== ctx.nodeId);
        const names = otherNodes.map((n, i) => {
          const t = n.translations[settings.languages[0]?.code];
          return `${i + 1}. ${t?.name ?? n.id}`;
        }).join("\n");
        const choice = prompt(`Connect to:\n${names}\n\nEnter number:`);
        if (!choice) { hide(); return; }
        const idx = parseInt(choice) - 1;
        if (idx < 0 || idx >= otherNodes.length) { hide(); return; }
        const targetId = otherNodes[idx].id;
        if (relations.some((r) => r.sourceId === ctx.nodeId && r.targetId === targetId)) {
          alert("Relation already exists"); hide(); return;
        }
        takeSnapshot("Add relation");
        const now = Date.now();
        const translations: Record<string, unknown> = {};
        for (const lang of settings.languages) {
          translations[lang.code] = { label: "", updatedAt: now };
        }
        setRelations([...relations, {
          id: crypto.randomUUID(),
          projectId: nodes[0]?.projectId ?? "",
          sourceId: ctx.nodeId!,
          targetId,
          translations: translations as any,
        }]);
        hide();
      }}>Add relation</button>

      {nodeRelations.length > 0 && <>
{nodeRelations.length > 0 && <>
        <div className="context-menu__separator" />
        {nodeRelations.map((rel) => {
          const otherId = rel.sourceId === ctx.nodeId ? rel.targetId : rel.sourceId;
          const dir = rel.sourceId === ctx.nodeId ? "→" : "←";
          const other = nodes.find((n) => n.id === otherId);
          const otherName = other?.translations[settings.languages[0]?.code]?.name ?? otherId;
          return <button key={rel.id} className="context-menu__item context-menu__item--danger"
            onClick={() => act(() => setRelations(relations.filter((r) => r.id !== rel.id)), "Remove relation")}>
            Remove relation {dir} {otherName}
          </button>;
        })}
      </>}

      <div className="context-menu__separator" />

      {hasChildren && <button className="context-menu__item" onClick={() => act(() => toggleCollapse(ctx.nodeId!))}>
        {collapsedNodes.has(ctx.nodeId!) ? "Expand children" : "Collapse children"}
      </button>}
      <button className="context-menu__item" onClick={() => act(() => setFocus(ctx.nodeId!, false))}>Focus on this node</button>
      <button className="context-menu__item" onClick={() => act(() => setFocus(ctx.nodeId!, true))}>Focus with parents</button>
      {focusNodeId && <button className="context-menu__item" onClick={() => act(() => resetView())}>
        Reset view (show all)
      </button>}

      {/* Layout toggles */}
      {hasStaffChildren && (
        <button className="context-menu__item" onClick={() => act(() => {
          const newLayout = node.staffLayout === "horizontal" ? "vertical" : "horizontal";
          setNodes(nodes.map((n) => n.id === ctx.nodeId ? { ...n, staffLayout: newLayout } : n));
          syncNodes();
        }, "Toggle staff layout")}>
          Staff layout: {node.staffLayout === "horizontal" ? "→ Vertical" : "→ Horizontal"}
        </button>
      )}
      {hasRegularChildren && (
        <button className="context-menu__item" onClick={() => act(() => {
          const newLayout = node.childrenLayout === "horizontal" ? "vertical" : "horizontal";
          setNodes(nodes.map((n) => n.id === ctx.nodeId ? { ...n, childrenLayout: newLayout } : n));
          syncNodes();
        }, "Toggle children layout")}>
          Children layout: {node.childrenLayout === "horizontal" ? "→ Vertical" : "→ Horizontal"}
        </button>
      )}

      <div className="context-menu__separator" />

      {!isRoot && <>
        <button className="context-menu__item context-menu__item--danger" onClick={() => act(() => {
          const updated = nodes.filter((n) => n.id !== ctx.nodeId).map((n) => n.parentId === ctx.nodeId ? { ...n, parentId: node.parentId } : n);
          setNodes(updated);
          setRelations(relations.filter((r) => r.sourceId !== ctx.nodeId && r.targetId !== ctx.nodeId));
          syncNodes();
        }, "Delete (promote)")}>Delete (promote children)</button>
        <button className="context-menu__item context-menu__item--danger" onClick={() => act(() => {
          const toRemove = new Set<string>();
          const queue = [ctx.nodeId!];
          while (queue.length > 0) { const id = queue.shift()!; toRemove.add(id); nodes.filter((n) => n.parentId === id).forEach((n) => queue.push(n.id)); }
          const updated = nodes.filter((n) => !toRemove.has(n.id));
          setNodes(updated);
          const ids = new Set(updated.map((n) => n.id));
          setRelations(relations.filter((r) => ids.has(r.sourceId) && ids.has(r.targetId)));
          syncNodes();
        }, "Delete subtree")}>Delete subtree</button>
      </>}
    </div>
  );
}
