import { memo, useState, useRef, useEffect, useCallback } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useStore } from "@/store";

export interface OrgNodeData {
  label: string;
  description: string;
  personNames: string;
  peopleCount: number;
  isFallback: boolean;
  isStaff: boolean;
  isSelected: boolean;
  nodeId: string;
  translationStatus: string;
  isCollapsed: boolean;
  hiddenCount: number;
  tagColors: string[];
  isVertical: boolean;
  nodeWidth: number;
  [key: string]: unknown;
}

function OrgNodeComponent({ data }: NodeProps) {
  const d = data as unknown as OrgNodeData;
  const editingNodeId = useStore((s) => s.editingNodeId);
  const setEditingNodeId = useStore((s) => s.setEditingNodeId);
  const isEditing = editingNodeId === d.nodeId;
  const showNames = useStore((s) => s.showNames);

  const [editValue, setEditValue] = useState(d.label);
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);

  const nodes = useStore((s) => s.nodes);
  const setNodes = useStore((s) => s.setNodes);
  const syncNodes = useStore((s) => s.syncNodes);
  const activeLanguage = useStore((s) => s.activeLanguage);
  const settings = useStore((s) => s.settings);
  const showContextMenu = useStore((s) => s.showContextMenu);
  const takeSnapshot = useStore((s) => s.takeSnapshot);

  useEffect(() => {
    if (isEditing) {
      setEditValue(d.label);
      committedRef.current = false;
      setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 0);
    }
  }, [isEditing, d.label]);

  const commitRename = useCallback(() => {
    if (committedRef.current) return;
    committedRef.current = true;
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== d.label) {
      takeSnapshot("Rename node");
      const updated = nodes.map((n) => {
        if (n.id !== d.nodeId) return n;
        const existing = n.translations[activeLanguage] ?? { name: "", description: "", mandate: "", responsibility: "", authority: "", tasks: "", kpi: "", updatedAt: 0 };
        return {
          ...n,
          translations: {
            ...n.translations,
            [activeLanguage]: { ...existing, name: trimmed, updatedAt: Date.now() },
          },
        };
      });
      setNodes(updated);
      syncNodes();
    }
    setEditingNodeId(null);
  }, [editValue, d.label, nodes, d.nodeId, activeLanguage, setNodes, syncNodes, setEditingNodeId, takeSnapshot]);

  const handleAddChild = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const name = prompt("Node name:");
    if (!name?.trim()) return;
    takeSnapshot("Add child");
    const now = Date.now();
    const translations: Record<string, unknown> = {};
    for (const lang of settings.languages) {
      translations[lang.code] = {
        name: name.trim(), description: "", mandate: "", responsibility: "",
        authority: "", tasks: "", kpi: "",
        updatedAt: lang.code === activeLanguage ? now : now - 1,
      };
    }
    const siblings = nodes.filter((n) => n.parentId === d.nodeId && !n.isStaff);
    const newNode = {
      id: crypto.randomUUID(),
      projectId: nodes[0]?.projectId ?? "",
      parentId: d.nodeId,
      isStaff: false,
      order: siblings.length,
      staffLayout: "horizontal" as const,
      childrenLayout: "horizontal" as const,
      assignedPeople: [],
      tags: [],
      note: "",
      translations: translations as any,
    };
    setNodes([...nodes, newNode]);
    syncNodes();
  }, [nodes, d.nodeId, activeLanguage, settings, setNodes, syncNodes, takeSnapshot]);

  const handleAddSibling = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const currentNode = nodes.find((n) => n.id === d.nodeId);
    if (!currentNode || !currentNode.parentId) return;
    const name = prompt("Node name:");
    if (!name?.trim()) return;
    takeSnapshot("Add sibling");
    const now = Date.now();
    const translations: Record<string, unknown> = {};
    for (const lang of settings.languages) {
      translations[lang.code] = {
        name: name.trim(), description: "", mandate: "", responsibility: "",
        authority: "", tasks: "", kpi: "",
        updatedAt: lang.code === activeLanguage ? now : now - 1,
      };
    }
    const siblings = nodes.filter((n) => n.parentId === currentNode.parentId && !n.isStaff);
    const newNode = {
      id: crypto.randomUUID(),
      projectId: nodes[0]?.projectId ?? "",
      parentId: currentNode.parentId,
      isStaff: false,
      order: siblings.length,
      staffLayout: "horizontal" as const,
      childrenLayout: "horizontal" as const,
      assignedPeople: [],
      tags: [],
      note: "",
      translations: translations as any,
    };
    setNodes([...nodes, newNode]);
    syncNodes();
  }, [nodes, d.nodeId, activeLanguage, settings, setNodes, syncNodes, takeSnapshot]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e.clientX, e.clientY, d.nodeId);
  }, [d.nodeId, showContextMenu]);

  const classes = ["org-node", d.isSelected ? "selected" : "", d.isStaff ? "staff" : "", d.isVertical ? "vertical" : ""].filter(Boolean).join(" ");
  const countLabel = d.peopleCount > 1 ? ` (${d.peopleCount})` : "";

  // Check if this node has a parent (for showing "add sibling" button)
  const currentNode = nodes.find((n) => n.id === d.nodeId);
  const hasParent = !!currentNode?.parentId;

  return (
    <div className="org-node-wrapper">
      <div className={classes} style={{ width: d.nodeWidth }} onDoubleClick={(e) => { e.stopPropagation(); setEditingNodeId(d.nodeId); }} onContextMenu={handleContextMenu}>
        <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
        {d.isVertical && <Handle type="target" position={Position.Left} id="left" style={{ opacity: 0 }} />}
        <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
        <Handle type="source" position={Position.Right} id="right" style={{ opacity: 0 }} />

        {d.isStaff && <div className="org-node__staff-badge">Staff</div>}

        {/* Tags */}
        {d.tagColors.length > 0 && (
          <div style={{ position: "absolute", top: -6, left: 8, display: "flex", gap: 2 }}>
            {d.tagColors.map((color, i) => (
              <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
            ))}
          </div>
        )}

        {isEditing ? (
          <input
            ref={inputRef}
            className="org-node__rename-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commitRename(); }
              if (e.key === "Escape") { committedRef.current = true; setEditingNodeId(null); }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              {d.translationStatus !== "ok" && (
                <span className={`org-node__status org-node__status--${d.translationStatus}`} />
              )}
              <div className={"org-node__name" + (d.isFallback ? " org-node__name--fallback" : "")}>
                {d.label}{countLabel}
              </div>
            </div>
            {showNames && d.personNames && <div className="org-node__person">{d.personNames}</div>}
            {d.description && <div className="org-node__desc">{d.description}</div>}
            {d.isCollapsed && d.hiddenCount > 0 && (
              <div className="org-node__collapse-badge">+{d.hiddenCount} hidden</div>
            )}
          </>
        )}
      </div>

      {!isEditing && (
        <>
          {hasParent && (
            <div className="org-node__hover-btns org-node__hover-btns--right">
              <button className="org-node__hover-btn" onClick={handleAddSibling} title="Add sibling">+</button>
            </div>
          )}
          <div className="org-node__hover-btns org-node__hover-btns--bottom">
            <button className="org-node__hover-btn" onClick={handleAddChild} title="Add child">+</button>
          </div>
        </>
      )}
    </div>
  );
}

export const CustomNode = memo(OrgNodeComponent);
