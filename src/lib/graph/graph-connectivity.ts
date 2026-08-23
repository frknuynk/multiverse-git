import type { MultiverseGraph } from "@/types/multiverse";

export function getNodesConnectedToSacredTimeline(
  graph: MultiverseGraph,
): Set<string> {
  const connectedNodeIds = new Set(
    graph.nodes
      .filter((node) => node.data.isDefaultBranch)
      .map((node) => node.id),
  );
  const adjacentNodeIds = createAdjacentNodeIds(graph);
  const pendingNodeIds = [...connectedNodeIds];

  for (const nodeId of pendingNodeIds) {
    for (const neighborId of adjacentNodeIds.get(nodeId) ?? []) {
      if (!connectedNodeIds.has(neighborId)) {
        connectedNodeIds.add(neighborId);
        pendingNodeIds.push(neighborId);
      }
    }
  }

  return connectedNodeIds;
}

export function createAdjacentNodeIds(graph: MultiverseGraph) {
  const adjacentNodeIds = new Map<string, string[]>(
    graph.nodes.map((node) => [node.id, []]),
  );

  for (const edge of graph.edges) {
    const sourceNeighbors = adjacentNodeIds.get(edge.source);
    const targetNeighbors = adjacentNodeIds.get(edge.target);

    if (!sourceNeighbors || !targetNeighbors) {
      continue;
    }

    sourceNeighbors.push(edge.target);
    targetNeighbors.push(edge.source);
  }

  return adjacentNodeIds;
}
