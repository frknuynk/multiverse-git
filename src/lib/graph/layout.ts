import ELK from "elkjs/lib/elk.bundled.js";

import type { MultiverseGraph } from "@/types/multiverse";

const elk = new ELK();

const NODE_WIDTH = 180;
const NODE_HEIGHT = 44;

export async function layoutMultiverseGraph(
  graph: MultiverseGraph,
): Promise<MultiverseGraph> {
  const layout = await elk.layout({
    id: "multiverse-graph",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.edgeRouting": "POLYLINE",
      "elk.layered.nodePlacement.favorStraightEdges": "true",
      "elk.layered.spacing.nodeNodeBetweenLayers": "100",
      "elk.spacing.nodeNode": "80",
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
          ? { "elk.layered.priority.straightness": "10" }
          : undefined,
    })),
  });

  const positions = new Map(
    layout.children?.map((node) => [node.id, { x: node.x ?? 0, y: node.y ?? 0 }]),
  );

  return {
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      position: positions.get(node.id) ?? node.position,
    })),
  };
}
