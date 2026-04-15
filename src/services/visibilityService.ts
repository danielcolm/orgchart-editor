import type { OrgNode } from "@/types/project";

export function getVisibleNodes(
  nodes: OrgNode[],
  collapsedNodes: Set<string>,
  focusNodeId: string | null,
  focusWithParents: boolean = false
): OrgNode[] {
  let candidates: OrgNode[];

  if (focusNodeId) {
    if (focusWithParents) {
      // Show focused node, its descendants, and all ancestors up to root
      const descendantIds = new Set<string>();
      const queue = [focusNodeId];
      while (queue.length > 0) {
        const id = queue.shift()!;
        descendantIds.add(id);
        for (const child of nodes.filter((n) => n.parentId === id)) queue.push(child.id);
      }
      // Walk ancestors
      const ancestorIds = new Set<string>();
      let current = nodes.find((n) => n.id === focusNodeId);
      while (current) {
        ancestorIds.add(current.id);
        current = current.parentId ? nodes.find((n) => n.id === current!.parentId) : undefined;
      }
      const visibleIds = new Set([...descendantIds, ...ancestorIds]);
      candidates = nodes.filter((n) => visibleIds.has(n.id));
    } else {
      const descendantIds = new Set<string>();
      const queue = [focusNodeId];
      while (queue.length > 0) {
        const id = queue.shift()!;
        descendantIds.add(id);
        for (const child of nodes.filter((n) => n.parentId === id)) queue.push(child.id);
      }
      candidates = nodes.filter((n) => descendantIds.has(n.id));
      candidates = candidates.map((n) =>
        n.id === focusNodeId ? { ...n, parentId: null } : n
      );
    }
  } else {
    candidates = nodes;
  }

  const hiddenByCollapse = new Set<string>();
  for (const collapsedId of collapsedNodes) {
    const queue = candidates.filter((n) => n.parentId === collapsedId).map((n) => n.id);
    while (queue.length > 0) {
      const id = queue.shift()!;
      hiddenByCollapse.add(id);
      for (const child of candidates.filter((n) => n.parentId === id)) queue.push(child.id);
    }
  }

  return candidates.filter((n) => !hiddenByCollapse.has(n.id));
}

export function getHiddenChildCount(nodes: OrgNode[], nodeId: string): number {
  let count = 0;
  const queue = nodes.filter((n) => n.parentId === nodeId).map((n) => n.id);
  while (queue.length > 0) {
    const id = queue.shift()!;
    count++;
    for (const child of nodes.filter((n) => n.parentId === id)) queue.push(child.id);
  }
  return count;
}
