import type { MultiverseGraph } from "@/types/multiverse";

export interface SelectedLineage {
  edgeIds: Set<string>;
  nodeIds: Set<string>;
}

export function getSelectedLineage(
  graph: MultiverseGraph,
  selectedCommitId: string | null,
): SelectedLineage {
  const selectedCommit = graph.nodes.find(
    (node) => node.id === selectedCommitId,
  );

  if (!selectedCommit) {
    return { edgeIds: new Set(), nodeIds: new Set() };
  }

  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const incomingEdgesByNodeId = new Map<string, typeof graph.edges>();

  for (const edge of graph.edges) {
    const incomingEdges = incomingEdgesByNodeId.get(edge.target) ?? [];
    incomingEdges.push(edge);
    incomingEdgesByNodeId.set(edge.target, incomingEdges);
  }

  const edgeIds = new Set<string>();
  const nodeIds = new Set([selectedCommit.id]);
  const pendingNodeIds = [selectedCommit.id];
  const continueThroughSacredTimeline = selectedCommit.data.isDefaultBranch;

  for (const nodeId of pendingNodeIds) {
    const node = nodesById.get(nodeId);

    if (!node || (node.data.isDefaultBranch && !continueThroughSacredTimeline)) {
      continue;
    }

    for (const edge of incomingEdgesByNodeId.get(nodeId) ?? []) {
      const parentNode = nodesById.get(edge.source);

      if (!parentNode) {
        continue;
      }

      if (node.data.isDefaultBranch && !parentNode.data.isDefaultBranch) {
        continue;
      }

      edgeIds.add(edge.id);

      if (!nodeIds.has(parentNode.id)) {
        nodeIds.add(parentNode.id);
        pendingNodeIds.push(parentNode.id);
      }
    }
  }

  return { edgeIds, nodeIds };
}
