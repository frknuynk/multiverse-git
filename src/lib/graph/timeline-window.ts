import type { MultiverseGraph } from "@/types/multiverse";

export const INITIAL_SACRED_TIMELINE_WINDOW_SIZE = 4;

export interface TimelineWindowRange {
  endIndex: number;
  startIndex: number;
}

export interface TimelineWindow {
  endIndex: number;
  isFullTimeline: boolean;
  sacredNodeIds: string[];
  startIndex: number;
  visibleEdgeIds: Set<string>;
  visibleNodeIds: Set<string>;
}

export function getSacredTimelineNodeIds(
  graph: MultiverseGraph,
): string[] {
  const sacredNodes = graph.nodes.filter(
    (node) => node.data.isDefaultBranch,
  );
  const sacredNodeIds = new Set(sacredNodes.map((node) => node.id));

  if (sacredNodeIds.size === 0) {
    return [];
  }

  const sourceIndexById = new Map(
    sacredNodes.map((node, index) => [node.id, index]),
  );
  const childNodeIdsById = new Map<string, string[]>(
    sacredNodes.map((node) => [node.id, []]),
  );
  const incomingEdgeCountById = new Map(
    sacredNodes.map((node) => [node.id, 0]),
  );

  for (const edge of graph.edges) {
    if (
      edge.type !== "sacred" ||
      !sacredNodeIds.has(edge.source) ||
      !sacredNodeIds.has(edge.target)
    ) {
      continue;
    }

    childNodeIdsById.get(edge.source)?.push(edge.target);
    incomingEdgeCountById.set(
      edge.target,
      (incomingEdgeCountById.get(edge.target) ?? 0) + 1,
    );
  }

  const compareBySourceOrder = (left: string, right: string) =>
    (sourceIndexById.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (sourceIndexById.get(right) ?? Number.MAX_SAFE_INTEGER) ||
    left.localeCompare(right);
  const pendingNodeIds = sacredNodes
    .map((node) => node.id)
    .filter((id) => (incomingEdgeCountById.get(id) ?? 0) === 0)
    .sort(compareBySourceOrder);
  const orderedNodeIds: string[] = [];

  while (pendingNodeIds.length > 0) {
    const nodeId = pendingNodeIds.shift();

    if (!nodeId) {
      continue;
    }

    orderedNodeIds.push(nodeId);

    for (const childNodeId of (childNodeIdsById.get(nodeId) ?? []).sort(
      compareBySourceOrder,
    )) {
      const incomingEdgeCount = (incomingEdgeCountById.get(childNodeId) ?? 0) - 1;
      incomingEdgeCountById.set(childNodeId, incomingEdgeCount);

      if (incomingEdgeCount === 0) {
        pendingNodeIds.push(childNodeId);
        pendingNodeIds.sort(compareBySourceOrder);
      }
    }
  }

  // A partial graph can be missing a Sacred edge. Keep those existing nodes in
  // a deterministic fallback order rather than dropping or guessing history.
  for (const node of sacredNodes) {
    if (!orderedNodeIds.includes(node.id)) {
      orderedNodeIds.push(node.id);
    }
  }

  return orderedNodeIds;
}

export function getTimelineWindow(
  graph: MultiverseGraph,
  range: TimelineWindowRange,
): TimelineWindow {
  const sacredNodeIds = getSacredTimelineNodeIds(graph);

  if (sacredNodeIds.length === 0) {
    return {
      endIndex: -1,
      isFullTimeline: true,
      sacredNodeIds,
      startIndex: 0,
      visibleEdgeIds: new Set(graph.edges.map((edge) => edge.id)),
      visibleNodeIds: new Set(graph.nodes.map((node) => node.id)),
    };
  }

  const normalizedRange = normalizeTimelineWindowRange(range, sacredNodeIds.length);
  const isFullTimeline =
    normalizedRange.startIndex === 0 &&
    normalizedRange.endIndex === sacredNodeIds.length - 1;

  if (isFullTimeline) {
    return {
      ...normalizedRange,
      isFullTimeline,
      sacredNodeIds,
      visibleEdgeIds: new Set(graph.edges.map((edge) => edge.id)),
      visibleNodeIds: new Set(graph.nodes.map((node) => node.id)),
    };
  }

  const visibleSacredNodeIds = new Set(
    sacredNodeIds.slice(normalizedRange.startIndex, normalizedRange.endIndex + 1),
  );
  const visibleNodeIds = new Set(visibleSacredNodeIds);
  const adjacentEdgesByNodeId = createAdjacentEdgesByNodeId(graph);
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const pendingNodeIds = Array.from(visibleSacredNodeIds);

  for (const nodeId of pendingNodeIds) {
    for (const edge of adjacentEdgesByNodeId.get(nodeId) ?? []) {
      const adjacentNodeId = edge.source === nodeId ? edge.target : edge.source;
      const adjacentNode = nodesById.get(adjacentNodeId);

      if (!adjacentNode) {
        continue;
      }

      if (
        adjacentNode.data.isDefaultBranch &&
        !visibleSacredNodeIds.has(adjacentNodeId)
      ) {
        continue;
      }

      if (!visibleNodeIds.has(adjacentNodeId)) {
        visibleNodeIds.add(adjacentNodeId);
        pendingNodeIds.push(adjacentNodeId);
      }
    }
  }

  return {
    ...normalizedRange,
    isFullTimeline,
    sacredNodeIds,
    visibleEdgeIds: new Set(
      graph.edges
        .filter(
          (edge) =>
            visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
        )
        .map((edge) => edge.id),
    ),
    visibleNodeIds,
  };
}

/**
 * A dense full-history overview is useful in the MiniMap but unreadable as an
 * initial canvas state. Start recent, bounded samples on a readable Sacred
 * Timeline interval; callers can always restore the complete sample.
 */
export function getInitialTimelineWindowRange(
  graph: MultiverseGraph,
  windowSize = INITIAL_SACRED_TIMELINE_WINDOW_SIZE,
): TimelineWindowRange {
  const sacredNodeIds = getSacredTimelineNodeIds(graph);

  if (sacredNodeIds.length <= windowSize) {
    return { endIndex: Number.MAX_SAFE_INTEGER, startIndex: 0 };
  }

  return {
    endIndex: sacredNodeIds.length - 1,
    startIndex: Math.max(0, sacredNodeIds.length - windowSize),
  };
}

export function getTimelineWindowRangeForCommitIds(
  graph: MultiverseGraph,
  startCommitId: string,
  endCommitId: string,
): TimelineWindowRange | null {
  const sacredNodeIds = getSacredTimelineNodeIds(graph);
  const startIndex = sacredNodeIds.indexOf(startCommitId);
  const endIndex = sacredNodeIds.indexOf(endCommitId);

  if (startIndex === -1 || endIndex === -1) {
    return null;
  }

  return normalizeTimelineWindowRange(
    { endIndex, startIndex },
    sacredNodeIds.length,
  );
}

export function normalizeTimelineWindowRange(
  range: TimelineWindowRange,
  sacredNodeCount: number,
): TimelineWindowRange {
  const maximumIndex = Math.max(0, sacredNodeCount - 1);
  const startIndex = clamp(Math.min(range.startIndex, range.endIndex), 0, maximumIndex);
  const endIndex = clamp(Math.max(range.startIndex, range.endIndex), 0, maximumIndex);

  return { endIndex, startIndex };
}

function createAdjacentEdgesByNodeId(graph: MultiverseGraph) {
  const adjacentEdgesByNodeId = new Map<string, typeof graph.edges>(
    graph.nodes.map((node) => [node.id, []]),
  );

  for (const edge of graph.edges) {
    adjacentEdgesByNodeId.get(edge.source)?.push(edge);
    adjacentEdgesByNodeId.get(edge.target)?.push(edge);
  }

  return adjacentEdgesByNodeId;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}
