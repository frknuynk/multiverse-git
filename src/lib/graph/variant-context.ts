import type { MultiverseGraph } from "@/types/multiverse";

export interface VariantContextInfo {
  branchName: string | null;
  commitsShown: number;
  connectsToSacredTimeline: boolean;
  riskScore: number;
}

export function getVariantContexts(
  graph: MultiverseGraph,
  selectedCommitId: string | null,
): VariantContextInfo[] {
  const selectedCommit = graph.nodes.find(
    (node) => node.id === selectedCommitId,
  );

  if (!selectedCommit || selectedCommit.data.isDefaultBranch) {
    return [];
  }

  const nodesConnectedToSacredTimeline = getNodesConnectedToSacredTimeline(graph);
  const branchesByName = new Map(
    graph.branches.map((branch) => [branch.name, branch]),
  );
  const commitsShownByBranch = new Map<string, number>();

  for (const node of graph.nodes) {
    for (const branchName of node.data.branches) {
      commitsShownByBranch.set(
        branchName,
        (commitsShownByBranch.get(branchName) ?? 0) + 1,
      );
    }
  }

  const namedContexts = selectedCommit.data.branches.flatMap((branchName) => {
    const branch = branchesByName.get(branchName);

    if (!branch || branch.isDefault) {
      return [];
    }

    return [
      {
        branchName: branch.name,
        commitsShown: commitsShownByBranch.get(branch.name) ?? 0,
        connectsToSacredTimeline: nodesConnectedToSacredTimeline.has(
          branch.tipOid,
        ),
        riskScore: branch.riskScore,
      },
    ];
  });

  if (namedContexts.length > 0) {
    return namedContexts;
  }

  return [
    {
      branchName: null,
      commitsShown: getVariantSegmentCommitCount(graph, selectedCommit.id),
      connectsToSacredTimeline: nodesConnectedToSacredTimeline.has(
        selectedCommit.id,
      ),
      riskScore: selectedCommit.data.riskScore,
    },
  ];
}

function getNodesConnectedToSacredTimeline(graph: MultiverseGraph) {
  const sacredNodeIds = graph.nodes
    .filter((node) => node.data.isDefaultBranch)
    .map((node) => node.id);
  const adjacentNodeIds = createAdjacentNodeIds(graph);
  const connectedNodeIds = new Set(sacredNodeIds);
  const pendingNodeIds = [...sacredNodeIds];

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

function getVariantSegmentCommitCount(
  graph: MultiverseGraph,
  startingNodeId: string,
) {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const adjacentNodeIds = createAdjacentNodeIds(graph);
  const segmentNodeIds = new Set([startingNodeId]);
  const pendingNodeIds = [startingNodeId];

  for (const nodeId of pendingNodeIds) {
    for (const adjacentNodeId of adjacentNodeIds.get(nodeId) ?? []) {
      const adjacentNode = nodesById.get(adjacentNodeId);

      if (
        adjacentNode &&
        !adjacentNode.data.isDefaultBranch &&
        !segmentNodeIds.has(adjacentNodeId)
      ) {
        segmentNodeIds.add(adjacentNodeId);
        pendingNodeIds.push(adjacentNodeId);
      }
    }
  }

  return segmentNodeIds.size;
}

function createAdjacentNodeIds(graph: MultiverseGraph) {
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
