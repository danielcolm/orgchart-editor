import dagre from "@dagrejs/dagre";
import type { OrgNode } from "@/types/project";

const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;
const VERT_NODE_WIDTH = 160;
const RANK_SEP = 90;
const NODE_SEP = 40;
const VERT_ROW_GAP = 24;
const VERT_INDENT = 20;
const GROUP_GAP = 60;

export interface LayoutPosition {
  id: string;
  x: number;
  y: number;
  width: number;
  isVertical: boolean;
}

export interface LayoutResult {
  positions: LayoutPosition[];
}

interface SubtreeResult {
  positions: LayoutPosition[];
  width: number;
  height: number;
}

export function computeLayout(
  nodes: OrgNode[],
  nodeHeights?: Map<string, number>
): LayoutResult {
  if (nodes.length === 0) return { positions: [] };

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  function getHeight(nodeId: string): number {
    return nodeHeights?.get(nodeId) ?? NODE_HEIGHT;
  }

  function getStaffChildren(parentId: string): OrgNode[] {
    return nodes.filter((n) => n.parentId === parentId && n.isStaff).sort((a, b) => a.order - b.order);
  }
  function getRegularChildren(parentId: string): OrgNode[] {
    return nodes.filter((n) => n.parentId === parentId && !n.isStaff).sort((a, b) => a.order - b.order);
  }

  function isInVerticalChain(nodeId: string): boolean {
    const node = nodeMap.get(nodeId);
    if (!node || !node.parentId) return false;
    const parent = nodeMap.get(node.parentId);
    if (!parent) return false;
    const parentLayout = node.isStaff ? parent.staffLayout : parent.childrenLayout;
    if (parentLayout === "vertical") return true;
    return isInVerticalChain(node.parentId);
  }

  function getEffectiveLayout(nodeId: string, which: "staff" | "children"): "horizontal" | "vertical" {
    const node = nodeMap.get(nodeId);
    if (!node) return "horizontal";
    if (isInVerticalChain(nodeId)) return "vertical";
    return which === "staff" ? node.staffLayout : node.childrenLayout;
  }

  function layoutVerticalGroup(childNodes: OrgNode[]): SubtreeResult {
    if (childNodes.length === 0) return { positions: [], width: 0, height: 0 };

    const allPositions: LayoutPosition[] = [];
    let currentY = 0;
    let maxWidth = VERT_NODE_WIDTH;

    for (const child of childNodes) {
      const h = getHeight(child.id);
      allPositions.push({ id: child.id, x: 0, y: currentY, width: VERT_NODE_WIDTH, isVertical: true });
      currentY += h + VERT_ROW_GAP;

      const sub = layoutNodeChildren(child.id);
      if (sub.positions.length > 0) {
        for (const pos of sub.positions) {
          allPositions.push({ ...pos, x: pos.x + VERT_INDENT, y: pos.y + currentY });
        }
        currentY += sub.height + VERT_ROW_GAP;
        maxWidth = Math.max(maxWidth, sub.width + VERT_INDENT);
      }
    }
    return { positions: allPositions, width: maxWidth, height: Math.max(0, currentY - VERT_ROW_GAP) };
  }

  function layoutHorizontalGroup(childNodes: OrgNode[]): SubtreeResult {
    if (childNodes.length === 0) return { positions: [], width: 0, height: 0 };

    function collectHoriz(rootIds: string[]): string[] {
      const result: string[] = [];
      const queue = [...rootIds];
      while (queue.length > 0) {
        const id = queue.shift()!;
        result.push(id);
        const sL = getEffectiveLayout(id, "staff");
        const cL = getEffectiveLayout(id, "children");
        if (sL === "horizontal") for (const s of getStaffChildren(id)) queue.push(s.id);
        if (cL === "horizontal") for (const c of getRegularChildren(id)) queue.push(c.id);
      }
      return result;
    }

    const allIds = collectHoriz(childNodes.map((n) => n.id));
    const idSet = new Set(allIds);

    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: "TB", ranksep: RANK_SEP, nodesep: NODE_SEP, marginx: 0, marginy: 0 });
    g.setDefaultEdgeLabel(() => ({}));
    for (const id of allIds) g.setNode(id, { width: NODE_WIDTH, height: getHeight(id) });

    const childrenByParent = new Map<string, OrgNode[]>();
    for (const id of allIds) {
      const node = nodeMap.get(id)!;
      if (node.parentId && idSet.has(node.parentId)) {
        const list = childrenByParent.get(node.parentId) ?? [];
        list.push(node);
        childrenByParent.set(node.parentId, list);
      }
    }
    for (const [pid, children] of childrenByParent) {
      const sorted = [
        ...children.filter((n) => n.isStaff).sort((a, b) => a.order - b.order),
        ...children.filter((n) => !n.isStaff).sort((a, b) => a.order - b.order),
      ];
      for (const child of sorted) g.setEdge(pid, child.id);
    }

    dagre.layout(g);

    const positions: LayoutPosition[] = allIds.map((id) => {
      const pos = g.node(id);
      const h = getHeight(id);
      return { id, x: pos.x - NODE_WIDTH / 2, y: pos.y - h / 2, width: NODE_WIDTH, isVertical: false };
    });

    const posById = new Map(positions.map((p) => [p.id, p]));

    function getDescIds(nid: string): string[] {
      const res: string[] = [];
      const q = allIds.filter((i) => { const n = nodeMap.get(i); return n && n.parentId === nid; });
      while (q.length > 0) {
        const i = q.shift()!;
        res.push(i);
        for (const c of allIds.filter((x) => { const n = nodeMap.get(x); return n && n.parentId === i; })) q.push(c);
      }
      return res;
    }

    for (const [, children] of childrenByParent) {
      if (children.length <= 1) continue;
      const desired = [
        ...children.filter((n) => n.isStaff).sort((a, b) => a.order - b.order),
        ...children.filter((n) => !n.isStaff).sort((a, b) => a.order - b.order),
      ];
      const xs = desired.map((n) => posById.get(n.id)?.x ?? 0).sort((a, b) => a - b);
      for (let i = 0; i < desired.length; i++) {
        const pos = posById.get(desired[i].id);
        if (!pos) continue;
        const dx = xs[i] - pos.x;
        if (dx !== 0) {
          pos.x = xs[i];
          for (const d of getDescIds(desired[i].id)) {
            const dp = posById.get(d);
            if (dp) dp.x += dx;
          }
        }
      }
    }

    // Handle vertical sub-groups within horizontal tree
    const verticalAttachments: LayoutPosition[] = [];
    for (const id of allIds) {
      const sL = getEffectiveLayout(id, "staff");
      const cL = getEffectiveLayout(id, "children");
      const vertStaff = sL === "vertical" ? getStaffChildren(id) : [];
      const vertChildren = cL === "vertical" ? getRegularChildren(id) : [];
      const vertNodes = [...vertStaff, ...vertChildren];
      if (vertNodes.length === 0) continue;

      const vertResult = layoutVerticalGroup(vertNodes);
      const parentPos = posById.get(id);
      if (!parentPos || vertResult.positions.length === 0) continue;

      const vOffsetX = parentPos.x;
      const vOffsetY = parentPos.y + getHeight(id) + RANK_SEP;
      const horizDescIds = getDescIds(id);
      const pushDown = vertResult.height + VERT_ROW_GAP;
      for (const did of horizDescIds) {
        const dp = posById.get(did);
        if (dp) dp.y += pushDown;
      }
      for (const vp of vertResult.positions) {
        verticalAttachments.push({ ...vp, x: vp.x + vOffsetX, y: vp.y + vOffsetY });
      }
    }
    positions.push(...verticalAttachments);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of positions) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x + (p.width ?? NODE_WIDTH));
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y + getHeight(p.id));
    }
    return { positions, width: positions.length > 0 ? maxX - minX : 0, height: positions.length > 0 ? maxY - minY : 0 };
  }

  function layoutNodeChildren(nodeId: string): SubtreeResult {
    const staffChildren = getStaffChildren(nodeId);
    const regularChildren = getRegularChildren(nodeId);
    if (staffChildren.length === 0 && regularChildren.length === 0) return { positions: [], width: 0, height: 0 };

    const sL = getEffectiveLayout(nodeId, "staff");
    const cL = getEffectiveLayout(nodeId, "children");

    if (sL === "horizontal" && cL === "horizontal") {
      return layoutHorizontalGroup([...staffChildren, ...regularChildren]);
    }
    if (sL === "vertical" && cL === "vertical") {
      return layoutVerticalGroup([...staffChildren, ...regularChildren]);
    }

    const staffResult = staffChildren.length > 0
      ? sL === "vertical" ? layoutVerticalGroup(staffChildren) : layoutHorizontalGroup(staffChildren)
      : { positions: [], width: 0, height: 0 };
    const childResult = regularChildren.length > 0
      ? cL === "vertical" ? layoutVerticalGroup(regularChildren) : layoutHorizontalGroup(regularChildren)
      : { positions: [], width: 0, height: 0 };

    const allPositions: LayoutPosition[] = [];
    if (staffResult.positions.length > 0 && childResult.positions.length > 0) {
      const sMinX = Math.min(...staffResult.positions.map((p) => p.x));
      const sMinY = Math.min(...staffResult.positions.map((p) => p.y));
      const cMinX = Math.min(...childResult.positions.map((p) => p.x));
      const cMinY = Math.min(...childResult.positions.map((p) => p.y));
      for (const p of staffResult.positions) allPositions.push({ ...p, x: p.x - sMinX, y: p.y - sMinY });
      const offsetX = staffResult.width + GROUP_GAP;
      for (const p of childResult.positions) allPositions.push({ ...p, x: p.x - cMinX + offsetX, y: p.y - cMinY });
    } else {
      const group = staffResult.positions.length > 0 ? staffResult : childResult;
      const minX = group.positions.length > 0 ? Math.min(...group.positions.map((p) => p.x)) : 0;
      const minY = group.positions.length > 0 ? Math.min(...group.positions.map((p) => p.y)) : 0;
      for (const p of group.positions) allPositions.push({ ...p, x: p.x - minX, y: p.y - minY });
    }

    let w = 0, h = 0;
    if (allPositions.length > 0) {
      w = Math.max(...allPositions.map((p) => p.x + (p.width ?? NODE_WIDTH)));
      h = Math.max(...allPositions.map((p) => p.y + getHeight(p.id)));
    }
    return { positions: allPositions, width: w, height: h };
  }

  const roots = nodes.filter((n) => n.parentId === null);
  if (roots.length === 0) return { positions: [] };
  const root = roots[0];

  const rootPos: LayoutPosition = { id: root.id, x: 0, y: 40, width: NODE_WIDTH, isVertical: false };
  const subtree = layoutNodeChildren(root.id);
  const subtreeOffsetX = rootPos.x + NODE_WIDTH / 2 - subtree.width / 2;
  const subtreeOffsetY = rootPos.y + getHeight(root.id) + RANK_SEP;

  const allPositions: LayoutPosition[] = [rootPos];
  for (const p of subtree.positions) {
    allPositions.push({ ...p, x: p.x + subtreeOffsetX, y: p.y + subtreeOffsetY });
  }

  const minX = Math.min(...allPositions.map((p) => p.x));
  if (minX < 40) {
    const shift = 40 - minX;
    for (const p of allPositions) p.x += shift;
  }

  return { positions: allPositions };
}

export { NODE_WIDTH, NODE_HEIGHT, VERT_NODE_WIDTH };
