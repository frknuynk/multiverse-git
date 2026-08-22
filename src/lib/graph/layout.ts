import ELK from "elkjs/lib/elk.bundled.js";

import type { MultiverseGraph } from "@/types/multiverse";

const elk = new ELK();

const NODE_WIDTH = 180;
const NODE_HEIGHT = 44;
const VARIANT_DEPTH_SPACING = 12;
const MAX_VARIANT_DEPTH_OFFSET = 3;

const sacredEdgeLayoutOptions = {
  "elk.layered.priority.shortness": "10",
  "elk.layered.priority.straightness": "100",
};

export async function layoutMultiverseGraph(
  graph: MultiverseGraph,
): Promise<MultiverseGraph> {
  const layout = await elk.layout({
    id: "multiverse-graph",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.edgeRouting": "POLYLINE",
      "elk.layered.cycleBreaking.strategy": "DEPTH_FIRST",
      "elk.layered.layering.strategy": "NETWORK_SIMPLEX",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.layered.nodePlacement.favorStraightEdges": "false",
      "elk.layered.mergeEdges": "true",
      "elk.layered.unnecessaryBendpoints": "true",
      "elk.layered.spacing.edgeNodeBetweenLayers": "24",
      "elk.layered.spacing.nodeNodeBetweenLayers": "84",
      "elk.spacing.nodeNode": "64",
    },
    children: graph.nodes.map((node) => ({
      id: node.id,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    })),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
      layoutOptions:
        edge.type === "sacred"
          ? sacredEdgeLayoutOptions
          : undefined,
    })),
  });

  const positions = new Map(
    layout.children?.map((node) => [node.id, { x: node.x ?? 0, y: node.y ?? 0 }]),
  );
  const sacredPositions = graph.nodes
    .filter((node) => node.data.isDefaultBranch)
    .map((node) => positions.get(node.id) ?? node.position);
  const variantDepthById = getVariantDepths(graph);

  return {
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      position: getVariantPosition(
        node,
        positions,
        sacredPositions,
        variantDepthById.get(node.id) ?? 0,
      ),
    })),
  };
}

function getVariantPosition(
  node: MultiverseGraph["nodes"][number],
  positions: Map<string, { x: number; y: number }>,
  sacredPositions: Array<{ x: number; y: number }>,
  variantDepth: number,
) {
  const position = positions.get(node.id) ?? node.position;
  if (node.data.isDefaultBranch) {
    return position;
  }

  const nearestSacredPosition = sacredPositions.reduce<{ x: number; y: number } | null>(
    (nearest, candidate) =>
      !nearest || Math.abs(candidate.x - position.x) < Math.abs(nearest.x - position.x)
        ? candidate
        : nearest,
    null,
  );

  if (!nearestSacredPosition) {
    return position;
  }

  const offset = Math.min(variantDepth, MAX_VARIANT_DEPTH_OFFSET) * VARIANT_DEPTH_SPACING;
  const direction = position.y <= nearestSacredPosition.y ? -1 : 1;

  return {
    x: position.x,
    y: position.y + direction * offset,
  };
}

function getVariantDepths(graph: MultiverseGraph): Map<string, number> {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const depthById = new Map<string, number>();
  const visitingNodeIds = new Set<string>();

  const getDepth = (id: string): number => {
    const cachedDepth = depthById.get(id);
    if (cachedDepth !== undefined) {
      return cachedDepth;
    }

    const node = nodesById.get(id);
    if (!node || node.data.isDefaultBranch) {
      return 0;
    }

    if (visitingNodeIds.has(id)) {
      return 0;
    }

    visitingNodeIds.add(id);
    const parentDepth = Math.max(
      0,
      ...node.data.parents.map((parentId) => getDepth(parentId)),
    );
    visitingNodeIds.delete(id);
    const depth = parentDepth + 1;
    depthById.set(id, depth);
    return depth;
  };

  for (const node of graph.nodes) {
    getDepth(node.id);
  }

  return depthById;
}
