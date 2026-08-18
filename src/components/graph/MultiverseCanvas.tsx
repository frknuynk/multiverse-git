"use client";

import { useEffect, useMemo, useState } from "react";
import { Controls, MiniMap, Panel, ReactFlow, type Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  CommitNode,
  type CommitFlowNode,
} from "@/components/graph/nodes/CommitNode";
import { fakeMultiverseGraph } from "@/lib/graph/fake-multiverse-graph";
import { layoutMultiverseGraph } from "@/lib/graph/layout";
import { getRiskLevel } from "@/lib/graph/risk";
import type { MultiverseEdge, MultiverseGraph } from "@/types/multiverse";

const getEdgeStyle = (
  edge: MultiverseEdge,
  riskScoreByNode: Map<string, number>,
) => {
  if (edge.type === "sacred") {
    return { stroke: "#f5a623", strokeWidth: 4 };
  }

  const riskLevel = getRiskLevel(
    Math.max(
      riskScoreByNode.get(edge.source) ?? 0,
      riskScoreByNode.get(edge.target) ?? 0,
    ),
  );

  if (edge.type === "incursion" || riskLevel === "high") {
    return { stroke: "#ef4444", strokeWidth: 2.5 };
  }

  if (riskLevel === "medium") {
    return { stroke: "#a78bfa", strokeWidth: 1.5 };
  }

  return { stroke: "#22d3ee", strokeWidth: 1.5 };
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
});

const nodeTypes = { commit: CommitNode };

const getMiniMapNodeColor = (node: CommitFlowNode) => {
  if (node.data.isDefaultBranch) {
    return "#f5a623";
  }

  const riskLevel = getRiskLevel(node.data.riskScore);
  return riskLevel === "high"
    ? "#ef4444"
    : riskLevel === "medium"
      ? "#a78bfa"
      : "#22d3ee";
};

interface MultiverseCanvasProps {
  initialGraph?: MultiverseGraph;
  isSampled?: boolean;
}

export function MultiverseCanvas({
  initialGraph,
  isSampled = false,
}: MultiverseCanvasProps) {
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
  const summary = useMemo(
    () => ({
      commits: graph.nodes.length,
      variants: graph.branches.filter((branch) => !branch.isDefault).length,
    }),
    [graph.branches, graph.nodes.length],
  );

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="h-[600px] min-w-0 flex-1 overflow-hidden border border-white/10 bg-[#0c0c14]">
        <ReactFlow<CommitFlowNode>
          className="bg-[#0c0c14]"
          colorMode="dark"
          edges={edges}
          fitView
          nodes={nodes}
          nodesConnectable={false}
          nodesDraggable={false}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => setSelectedCommitId(node.id)}
          onlyRenderVisibleElements
        >
          <Panel
            className="m-3 border border-white/15 bg-[#12121d] px-3 py-2 text-xs text-[#f0f0f5]"
            position="top-left"
          >
            <div className="flex items-center gap-3">
              <span>
                <strong className="font-semibold">{summary.commits}</strong> commits
              </span>
              <span className="h-3 border-l border-white/15" />
              <span>
                <strong className="font-semibold">{summary.variants}</strong> Variants
              </span>
            </div>
            {isSampled ? (
              <p className="mt-1 text-[11px] text-[#a0a0b0]">
                Sampled view · recent commits and Variants
              </p>
            ) : null}
          </Panel>
          <Controls aria-label="Canvas navigation" position="bottom-left" showInteractive={false} />
          <MiniMap<CommitFlowNode>
            ariaLabel="Multiverse overview"
            bgColor="#12121d"
            maskColor="rgba(5, 5, 10, 0.78)"
            maskStrokeColor="#a0a0b0"
            nodeColor={getMiniMapNodeColor}
            nodeStrokeColor="#0c0c14"
            pannable
            position="bottom-right"
            zoomable
          />
        </ReactFlow>
      </div>

      {selectedCommit ? (
        <aside
          aria-live="polite"
          className="w-full border border-white/15 bg-[#12121d] p-5 text-[13px] leading-5 text-[#f0f0f5] lg:w-72"
        >
          <h2 className="text-sm font-semibold leading-5">
            {selectedCommit.data.headline}
          </h2>
          <dl className="mt-5 space-y-4">
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-[#a0a0b0]">
                Author
              </dt>
              <dd className="mt-0.5 break-words">
                {selectedCommit.data.author.name} ({selectedCommit.data.author.email})
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-[#a0a0b0]">
                Date
              </dt>
              <dd className="mt-0.5">
                {dateFormatter.format(new Date(selectedCommit.data.committedDate))}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-[#a0a0b0]">
                Sacred Timeline
              </dt>
              <dd className="mt-0.5">
                {selectedCommit.data.isDefaultBranch ? "Yes" : "No"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-[#a0a0b0]">
                Incursion Risk
              </dt>
              <dd className="mt-0.5">{selectedCommit.data.riskScore}</dd>
            </div>
          </dl>
        </aside>
      ) : null}
    </div>
  );
}
