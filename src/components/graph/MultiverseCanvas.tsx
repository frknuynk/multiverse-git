"use client";

import { useEffect, useMemo, useState } from "react";
import { ReactFlow, type Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  CommitNode,
  type CommitFlowNode,
} from "@/components/graph/nodes/CommitNode";
import { fakeMultiverseGraph } from "@/lib/graph/fake-multiverse-graph";
import { layoutMultiverseGraph } from "@/lib/graph/layout";
import type { MultiverseEdge, MultiverseGraph } from "@/types/multiverse";

const getEdgeStyle = (
  edge: MultiverseEdge,
  riskScoreByNode: Map<string, number>,
) => {
  if (edge.type === "sacred") {
    return { stroke: "#f5a623", strokeWidth: 4 };
  }

  const isHighRiskVariant =
    (edge.type === "variant" || edge.type === "incursion") &&
    Math.max(
      riskScoreByNode.get(edge.source) ?? 0,
      riskScoreByNode.get(edge.target) ?? 0,
    ) >= 60;

  if (edge.type === "incursion" || isHighRiskVariant) {
    return { stroke: "#ef4444", strokeWidth: 2.5 };
  }

  return { stroke: "#22d3ee", strokeWidth: 1.5 };
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
});

const nodeTypes = { commit: CommitNode };

interface MultiverseCanvasProps {
  initialGraph?: MultiverseGraph;
}

export function MultiverseCanvas({ initialGraph }: MultiverseCanvasProps) {
  const sourceGraph = initialGraph ?? fakeMultiverseGraph;
  const [graph, setGraph] = useState(sourceGraph);
  const [selectedCommitId, setSelectedCommitId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void layoutMultiverseGraph(sourceGraph)
      .then((layout) => {
        if (!cancelled) {
          setGraph(layout);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [sourceGraph]);

  const riskScoreByNode = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node.data.riskScore])),
    [graph.nodes],
  );

  const nodes = useMemo<CommitFlowNode[]>(
    () =>
      graph.nodes.map((node) => ({
        ariaLabel: node.data.headline,
        id: node.id,
        data: {
          authorName: node.data.author.name,
          headline: node.data.headline,
          isDefaultBranch: node.data.isDefaultBranch,
          riskScore: node.data.riskScore,
        },
        position: node.position,
        selected: node.id === selectedCommitId,
        style: { width: 180 },
        type: "commit",
      })),
    [graph.nodes, selectedCommitId],
  );

  const edges = useMemo<Edge[]>(
    () =>
      graph.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        style: getEdgeStyle(edge, riskScoreByNode),
      })),
    [graph.edges, riskScoreByNode],
  );

  const selectedCommit = useMemo(
    () => graph.nodes.find((node) => node.id === selectedCommitId),
    [graph.nodes, selectedCommitId],
  );

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="h-[600px] min-w-0 flex-1 overflow-hidden border border-white/10 bg-[#0c0c14]">
        <ReactFlow<CommitFlowNode>
          className="bg-[#0c0c14]"
          edges={edges}
          fitView
          nodes={nodes}
          nodesConnectable={false}
          nodesDraggable={false}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => setSelectedCommitId(node.id)}
          onlyRenderVisibleElements
        />
      </div>

      {selectedCommit ? (
        <aside
          aria-live="polite"
          className="w-full border border-white/10 bg-[#0c0c14] p-4 text-sm text-[#f0f0f5] lg:w-72"
        >
          <h2 className="font-semibold">{selectedCommit.data.headline}</h2>
          <dl className="mt-4 space-y-3">
            <div>
              <dt className="text-[#a0a0b0]">Author</dt>
              <dd>
                {selectedCommit.data.author.name} ({selectedCommit.data.author.email})
              </dd>
            </div>
            <div>
              <dt className="text-[#a0a0b0]">Date</dt>
              <dd>{dateFormatter.format(new Date(selectedCommit.data.committedDate))}</dd>
            </div>
            <div>
              <dt className="text-[#a0a0b0]">Sacred Timeline</dt>
              <dd>{selectedCommit.data.isDefaultBranch ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="text-[#a0a0b0]">Incursion Risk</dt>
              <dd>{selectedCommit.data.riskScore}</dd>
            </div>
          </dl>
        </aside>
      ) : null}
    </div>
  );
}
