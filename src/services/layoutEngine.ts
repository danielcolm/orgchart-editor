import dagre from "@dagrejs/dagre";
import type { OrgNode } from "@/types/project";

const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;
const RANK_SEP = 90;
const NODE_SEP = 40;

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

export function computeLayout(nodes: OrgNode[]): LayoutResult {
  if (nodes.length === 0) return { positions: [] };

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", ranksep: RANK_SEP, nodesep: NODE_SEP, marginx: 40, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  const childrenByParent = new Map<string, OrgNode[]>();
  for (const node of nodes) {
    if (!node.parentId) continue;
    const list = childrenByParent.get(node.parentId) ?? [];
    list.push(node);
    childrenByParent.set(node.parentId, list);
  }

  for (const [parentId, children] of childrenByParent) {
    const sorted = [
      ...children.filter((n) => n.isStaff).sort((a, b) => a.order - b.order),
      ...children.filter((n) => !n.isStaff).sort((a, b) => a.order - b.order),
    ];
    for (const child of sorted) g.setEdge(parentId, child.id);
  }

  dagre.layout(g);

  const positions: LayoutPosition[] = nodes.map((node) => {
    const pos = g.node(node.id);
    return { id: node.id, x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2, width: NODE_WIDTH, isVertical: false };
  });

  // Enforce sibling order
  const posById = new Map(positions.map((p) => [p.id, p]));

  function getDescIds(nid: string): string[] {
    const res: string[] = [];
    const q = nodes.filter((n) => n.parentId === nid).map((n) => n.id);
    while (q.length > 0) {
      const i = q.shift()!;
      res.push(i);
      for (const c of nodes.filter((n) => n.parentId === i)) q.push(c.id);
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

  return { positions };
}

export { NODE_WIDTH, NODE_HEIGHT };
