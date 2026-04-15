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
      <button className="context-menu__item" onClick={() => act(() => setFocus(ctx.nodeId!))}>Focus on this node</button>
      <button className="context-menu__item" onClick={() => {
        // Focus with parents — store focusNodeId and a flag
        // For simplicity, we use a special prefix
        act(() => {
          // We'll handle this by setting focus and keeping parents visible
          // The visibility service already supports focusWithParents
          useStore.setState({ focusNodeId: ctx.nodeId! });
          // Store a flag in localStorage for "with parents" mode
          localStorage.setItem("orgchart-focus-with-parents", "true");
        });
      }}>Focus with parents</button>
      {focusNodeId && <button className="context-menu__item" onClick={() => act(() => { resetView(); localStorage.removeItem("orgchart-focus-with-parents"); })}>
        Reset view (show all)
      </button>}

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
