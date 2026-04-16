import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow, Background, Controls, MiniMap,
  type Node, type Edge, type OnNodesChange, type Connection,
  useReactFlow, ReactFlowProvider, MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useStore } from "@/store";
import { CustomNode, type OrgNodeData } from "./CustomNode";
import { NodeContextMenu } from "@/components/ContextMenu/NodeContextMenu";
import { computeLayout } from "@/services/layoutEngine";
import { getVisibleNodes, getHiddenChildCount } from "@/services/visibilityService";
import { wouldCreateCycle } from "@/utils/cycleDetector";

const nodeTypes = { orgNode: CustomNode };

function CanvasInner() {
  const allNodes = useStore((s) => s.nodes);
  const relations = useStore((s) => s.relations);
  const people = useStore((s) => s.people);
  const activeLanguage = useStore((s) => s.activeLanguage);
  const settings = useStore((s) => s.settings);
  const selectedNodeId = useStore((s) => s.selectedNodeId);
  const selectNode = useStore((s) => s.selectNode);
  const setNodes = useStore((s) => s.setNodes);
  const syncNodes = useStore((s) => s.syncNodes);
  const setRelations = useStore((s) => s.setRelations);
  const hideContextMenu = useStore((s) => s.hideContextMenu);
  const collapsedNodes = useStore((s) => s.collapsedNodes);
  const focusNodeId = useStore((s) => s.focusNodeId);
  const focusWithParents = useStore((s) => s.focusWithParents);
  const collapseAfterLevel = useStore((s) => s.collapseAfterLevel);
  const takeSnapshot = useStore((s) => s.takeSnapshot);
  const showNames = useStore((s) => s.showNames);

  const { fitView } = useReactFlow();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragPositions, setDragPositions] = useState<Map<string, { x: number; y: number }>>(new Map());

  const dominantLang = settings.dominantLanguage;

  const visibleNodes = useMemo(
    () => getVisibleNodes(allNodes, collapsedNodes, focusNodeId, focusWithParents, collapseAfterLevel),
    [allNodes, collapsedNodes, focusNodeId, focusWithParents, collapseAfterLevel]
  );

  const layoutResult = useMemo(() => computeLayout(visibleNodes), [visibleNodes]);
  const layoutMap = useMemo(
    () => new Map(layoutResult.positions.map((p) => [p.id, p])),
    [layoutResult]
  );
  const posMap = useMemo(
    () => new Map(layoutResult.positions.map((p) => [p.id, { x: p.x, y: p.y }])),
    [layoutResult]
  );

  const rfNodes: Node[] = useMemo(() => {
    return visibleNodes.map((node) => {
      const t = node.translations[activeLanguage] ?? node.translations[dominantLang];
      const isFallback = !node.translations[activeLanguage] && !!node.translations[dominantLang];
      const label = t?.name || node.id;
      const layoutPos = posMap.get(node.id) ?? { x: 0, y: 0 };
      const pos = dragPositions.get(node.id) ?? layoutPos;
      const isCollapsed = collapsedNodes.has(node.id);
      const hiddenCount = isCollapsed ? getHiddenChildCount(allNodes, node.id) : 0;

      // People names
      const assignedPeople = (node.assignedPeople ?? [])
        .map((uid) => people.find((p) => p.uid === uid))
        .filter(Boolean)
        .map((p) => `${p!.firstName} ${p!.lastName}`.trim());
      const personNames = assignedPeople.join(", ");

      // Tags
      const tagColors = (node.tags ?? [])
        .map((tid) => settings.tags.find((t) => t.id === tid)?.color)
        .filter(Boolean) as string[];

      // Translation status
      let status = "ok";
      if (!node.translations[activeLanguage]?.name) status = "missing";
      else if (node.translations[dominantLang]?.updatedAt > node.translations[activeLanguage]?.updatedAt) status = "outdated";

      const nodeData: OrgNodeData = {
        label, description: t?.description ?? "",
        personNames, peopleCount: node.assignedPeople?.length ?? 0,
        isFallback, isStaff: node.isStaff,
        isSelected: selectedNodeId === node.id,
        nodeId: node.id, translationStatus: status,
        isCollapsed, hiddenCount, tagColors,
        isVertical: layoutMap.get(node.id)?.isVertical ?? false,
        nodeWidth: layoutMap.get(node.id)?.width ?? 180,
      };

      return {
        id: node.id, type: "orgNode", position: pos, data: nodeData,
        draggable: true, className: draggingId === node.id ? "dragging" : "",
      };
    });
  }, [visibleNodes, allNodes, people, settings, activeLanguage, dominantLang, selectedNodeId, posMap, layoutMap, draggingId, dragPositions, collapsedNodes, showNames]);

  const rfEdges: Edge[] = useMemo(() => {
    const visibleIds = new Set(visibleNodes.map((n) => n.id));
    const parentEdges: Edge[] = visibleNodes
      .filter((n) => n.parentId && visibleIds.has(n.parentId))
      .map((n) => {
        const isVertical = layoutMap.get(n.id)?.isVertical ?? false;
        return {
          id: `e-${n.parentId}-${n.id}`,
          source: n.parentId!,
          target: n.id,
          sourceHandle: isVertical ? "right" : undefined,
          targetHandle: isVertical ? "left" : undefined,
          type: "smoothstep",
          style: { stroke: "var(--color-border)" },
        };
      });
    const relationEdges: Edge[] = relations
      .filter((r) => visibleIds.has(r.sourceId) && visibleIds.has(r.targetId))
      .map((r) => ({
        id: `r-${r.id}`, source: r.sourceId, target: r.targetId,
        type: "smoothstep",
        style: { stroke: "var(--color-border)", strokeDasharray: "6 4" },
        markerEnd: { type: MarkerType.ArrowClosed, color: "var(--color-border)" },
      }));
    return [...parentEdges, ...relationEdges];
  }, [visibleNodes, relations, layoutMap]);

  const handleNodesChange: OnNodesChange = useCallback((changes) => {
    for (const change of changes) {
      if (change.type === "position" && change.position && change.dragging) {
        setDraggingId(change.id);
        setDragPositions((prev) => { const n = new Map(prev); n.set(change.id, change.position!); return n; });
      }
      if (change.type === "position" && !change.dragging && draggingId) {
        const dp = dragPositions.get(draggingId);
        if (dp) {
          const T = 80; let closestId: string | null = null; let closestDist = Infinity;
          for (const pos of layoutResult.positions) {
            if (pos.id === draggingId) continue;
            const dist = Math.sqrt((dp.x - pos.x) ** 2 + (dp.y - pos.y) ** 2);
            if (dist < T && dist < closestDist) { closestDist = dist; closestId = pos.id; }
          }
          if (closestId && !wouldCreateCycle(allNodes, draggingId, closestId) && draggingId !== closestId) {
            takeSnapshot("Reparent node");
            const updated = allNodes.map((n) => n.id === draggingId ? { ...n, parentId: closestId } : n);
            setNodes(updated);
            syncNodes();
          }
        }
        setDraggingId(null);
        setDragPositions(new Map());
        setTimeout(() => fitView({ duration: 400 }), 50);
      }
    }
  }, [draggingId, dragPositions, layoutResult, allNodes, setNodes, syncNodes, fitView, takeSnapshot]);

  const handleConnect = useCallback((conn: Connection) => {
    if (!conn.source || !conn.target || conn.source === conn.target) return;
    if (relations.some((r) => r.sourceId === conn.source && r.targetId === conn.target)) return;
    takeSnapshot("Add relation");
    const now = Date.now();
    const translations: Record<string, unknown> = {};
    for (const lang of settings.languages) {
      translations[lang.code] = { label: "", updatedAt: now };
    }
    const newRel = {
      id: crypto.randomUUID(),
      projectId: allNodes[0]?.projectId ?? "",
      sourceId: conn.source, targetId: conn.target,
      translations: translations as any,
    };
    setRelations([...relations, newRel]);
  }, [relations, settings, allNodes, setRelations, takeSnapshot]);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={rfNodes} edges={rfEdges} nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onNodeClick={(_, node) => selectNode(node.id)}
        onPaneClick={() => { selectNode(null); hideContextMenu(); }}
        onConnect={handleConnect}
        fitView fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.2} maxZoom={2}
        defaultEdgeOptions={{ style: { stroke: "var(--color-border)" } }}
      >
        <Background gap={20} size={1} color="var(--color-border-subtle)" />
        <Controls style={{ background: "var(--color-bg-elevated)", borderColor: "var(--color-border)" }} />
        <MiniMap style={{ background: "var(--color-bg-elevated)" }} maskColor="rgba(15,17,23,0.7)" />
      </ReactFlow>
      <NodeContextMenu />
    </div>
  );
}

export function Canvas() {
  return <ReactFlowProvider><CanvasInner /></ReactFlowProvider>;
}
