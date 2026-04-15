import type { OrgNode } from "@/types/project";

export function wouldCreateCycle(
  nodes: OrgNode[],
  nodeId: string,
  newParentId: string | null
): boolean {
  if (newParentId === null) return false;
  if (newParentId === nodeId) return true;
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  let current: string | null = newParentId;
  while (current !== null) {
    if (current === nodeId) return true;
    const node = nodeMap.get(current);
    if (!node) break;
    current = node.parentId;
  }
  return false;
}
