"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  useReactFlow,
  useStore,
  useViewport,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  CommitNode,
  type CommitFlowNode,
} from "@/components/graph/nodes/CommitNode";
import {
  TimelineEdge,
  type TimelineFlowEdge,
} from "@/components/graph/edges/TimelineEdge";
import { fakeMultiverseGraph } from "@/lib/graph/fake-multiverse-graph";
import { layoutMultiverseGraph } from "@/lib/graph/layout";
import { getRiskLevel } from "@/lib/graph/risk";
import { getCommitFocus } from "@/lib/graph/commit-focus";
import {
  getVariantContexts,
  type VariantContextInfo,
} from "@/lib/graph/variant-context";
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
const edgeTypes = { timeline: TimelineEdge };
const MINI_MAP_WIDTH = 176;
const MINI_MAP_HEIGHT = 96;
const MINI_MAP_PADDING = 6;
const FLOW_NODE_WIDTH = 180;
const FLOW_NODE_HEIGHT = 44;
// Keep the complete connected sample in frame while using the available canvas
// area more efficiently. A lower padding improves label scanability without
// hiding the outer Variant tips.
const FIT_VIEW_OPTIONS = { padding: 0.08 };

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

const getMiniMapEdgeColor = (
  edge: Edge,
  nodesById: Map<string, CommitFlowNode>,
) => {
  if (edge.style?.stroke === "#f5a623") {
    return "#f5a623";
  }

  const riskLevel = getRiskLevel(
    Math.max(
      nodesById.get(edge.source)?.data.riskScore ?? 0,
      nodesById.get(edge.target)?.data.riskScore ?? 0,
    ),
  );

  return riskLevel === "high"
    ? "#ef4444"
    : riskLevel === "medium"
      ? "#a78bfa"
      : "#22d3ee";
};

interface GraphMiniMapOverlayProps {
  nodes: CommitFlowNode[];
  edges: Edge[];
}

function GraphMiniMapOverlay({ nodes, edges }: GraphMiniMapOverlayProps) {
  const { x, y, zoom } = useViewport();
  const flowWidth = useStore((state) => state.width);
  const flowHeight = useStore((state) => state.height);
  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const bounds = useMemo(() => getMiniMapBounds(nodes), [nodes]);
  const scale = Math.min(
    (MINI_MAP_WIDTH - MINI_MAP_PADDING * 2) / bounds.width,
    (MINI_MAP_HEIGHT - MINI_MAP_PADDING * 2) / bounds.height,
  );
  const offsetX = (MINI_MAP_WIDTH - bounds.width * scale) / 2 - bounds.x * scale;
  const offsetY = (MINI_MAP_HEIGHT - bounds.height * scale) / 2 - bounds.y * scale;
  const project = (pointX: number, pointY: number) => ({
    x: pointX * scale + offsetX,
    y: pointY * scale + offsetY,
  });
  const viewportPosition = project(-x / zoom, -y / zoom);

  return (
    <Panel
      className="pointer-events-none"
      position="bottom-right"
      style={{
        height: MINI_MAP_HEIGHT,
        pointerEvents: "none",
        width: MINI_MAP_WIDTH,
      }}
    >
      <svg
        aria-hidden="true"
        className="block"
        height={MINI_MAP_HEIGHT}
        viewBox={`0 0 ${MINI_MAP_WIDTH} ${MINI_MAP_HEIGHT}`}
        width={MINI_MAP_WIDTH}
      >
        <rect fill="#171724" height={MINI_MAP_HEIGHT} width={MINI_MAP_WIDTH} />
        {edges.map((edge) => {
          const source = nodesById.get(edge.source);
          const target = nodesById.get(edge.target);

          if (!source || !target) {
            return null;
          }

          const sourcePoint = project(
            source.position.x + FLOW_NODE_WIDTH / 2,
            source.position.y + FLOW_NODE_HEIGHT / 2,
          );
          const targetPoint = project(
            target.position.x + FLOW_NODE_WIDTH / 2,
            target.position.y + FLOW_NODE_HEIGHT / 2,
          );

          return (
            <line
              key={edge.id}
              stroke={getMiniMapEdgeColor(edge, nodesById)}
              strokeOpacity={0.9}
              strokeWidth={1}
              x1={sourcePoint.x}
              x2={targetPoint.x}
              y1={sourcePoint.y}
              y2={targetPoint.y}
            />
          );
        })}
        {nodes.map((node) => {
          const position = project(node.position.x, node.position.y);

          return (
            <rect
              fill={getMiniMapNodeColor(node)}
              height={Math.max(2, FLOW_NODE_HEIGHT * scale)}
              key={node.id}
              stroke="#f0f0f5"
              strokeWidth={0.5}
              width={Math.max(2, FLOW_NODE_WIDTH * scale)}
              x={position.x}
              y={position.y}
            />
          );
        })}
        <rect
          fill="rgba(240, 240, 245, 0.08)"
          height={(flowHeight / zoom) * scale}
          stroke="#f0f0f5"
          strokeWidth={1}
          width={(flowWidth / zoom) * scale}
          x={viewportPosition.x}
          y={viewportPosition.y}
        />
      </svg>
    </Panel>
  );
}

function getMiniMapBounds(nodes: CommitFlowNode[]) {
  if (nodes.length === 0) {
    return { height: 1, width: 1, x: 0, y: 0 };
  }

  const minX = Math.min(...nodes.map((node) => node.position.x));
  const minY = Math.min(...nodes.map((node) => node.position.y));
  const maxX = Math.max(...nodes.map((node) => node.position.x + FLOW_NODE_WIDTH));
  const maxY = Math.max(...nodes.map((node) => node.position.y + FLOW_NODE_HEIGHT));

  return {
    height: Math.max(1, maxY - minY),
    width: Math.max(1, maxX - minX),
    x: minX,
    y: minY,
  };
}

function hasRenderableGraph(
  graph: MultiverseGraph | undefined,
): graph is MultiverseGraph {
  return Boolean(
    graph &&
      Array.isArray(graph.nodes) &&
      graph.nodes.length > 0 &&
      Array.isArray(graph.edges) &&
      Array.isArray(graph.branches),
  );
}

function formatCommitDate(committedDate: string) {
  const date = new Date(committedDate);

  return Number.isNaN(date.getTime()) ? "Unknown" : dateFormatter.format(date);
}

function formatRiskLevel(riskScore: number) {
  const riskLevel = getRiskLevel(riskScore);

  if (riskLevel === "high") {
    return "High";
  }

  if (riskLevel === "medium") {
    return "Medium";
  }

  return "Healthy";
}

function FitGraphInView({ graph }: { graph: MultiverseGraph }) {
  const { fitView, viewportInitialized } = useReactFlow<CommitFlowNode>();

  useEffect(() => {
    if (!viewportInitialized) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      void fitView(FIT_VIEW_OPTIONS);
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [fitView, graph, viewportInitialized]);

  return null;
}

interface MultiverseCanvasProps {
  initialGraph?: MultiverseGraph;
  isSampled?: boolean;
}

export function MultiverseCanvas({
  initialGraph,
  isSampled = false,
}: MultiverseCanvasProps) {
  const isInitialGraphRenderable = hasRenderableGraph(initialGraph);
  const sourceGraph = isInitialGraphRenderable
    ? initialGraph
    : fakeMultiverseGraph;
  const isSampledView = isSampled && isInitialGraphRenderable;
  const [graph, setGraph] = useState(sourceGraph);
  const [selectedCommitId, setSelectedCommitId] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const selectCommit = useCallback((commitId: string) => {
    setSelectedCommitId((current) => (current === commitId ? current : commitId));
  }, []);

  const handleFlowKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      const nodeElement = (event.target as HTMLElement).closest<HTMLElement>(
        ".react-flow__node[data-id]",
      );
      const commitId = nodeElement?.dataset.id;

      if (!commitId) {
        return;
      }

      event.preventDefault();
      selectCommit(commitId);
    },
    [selectCommit],
  );

  useEffect(() => {
    let cancelled = false;

    void layoutMultiverseGraph(sourceGraph)
      .then((layout) => {
        if (!cancelled) {
          setGraph(layout);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGraph(sourceGraph);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sourceGraph]);

  const riskScoreByNode = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node.data.riskScore])),
    [graph.nodes],
  );
  const selectedCommit = useMemo(
    () => graph.nodes.find((node) => node.id === selectedCommitId),
    [graph.nodes, selectedCommitId],
  );
  const commitFocus = useMemo(
    () => getCommitFocus(graph, selectedCommitId),
    [graph, selectedCommitId],
  );
  const hasCommitFocus = commitFocus.kind !== "none";

  const nodes = useMemo<CommitFlowNode[]>(
    () =>
      graph.nodes.map((node) => ({
        ariaLabel: node.data.headline,
        id: node.id,
        data: {
          authorName: node.data.author.name,
          headline: node.data.headline,
          isDimmed:
            hasCommitFocus && !commitFocus.emphasizedNodeIds.has(node.id),
          isDefaultBranch: node.data.isDefaultBranch,
          isEmphasized: commitFocus.emphasizedNodeIds.has(node.id),
          riskScore: node.data.riskScore,
        },
        position: node.position,
        selected: node.id === selectedCommitId,
        style: { width: 180 },
        type: "commit",
      })),
    [commitFocus.emphasizedNodeIds, graph.nodes, hasCommitFocus, selectedCommitId],
  );

  const edges = useMemo<TimelineFlowEdge[]>(
    () =>
      graph.edges.map((edge) => ({
        data: {
          isEmphasized: commitFocus.emphasizedEdgeIds.has(edge.id),
          isSacred: edge.type === "sacred",
        },
        id: edge.id,
        source: edge.source,
        target: edge.target,
        style: {
          ...getEdgeStyle(edge, riskScoreByNode),
          opacity: hasCommitFocus && !commitFocus.emphasizedEdgeIds.has(edge.id)
            ? edge.type === "sacred"
              ? 0.55
              : 0.28
            : 1,
        },
        type: "timeline",
      })),
    [commitFocus.emphasizedEdgeIds, graph.edges, hasCommitFocus, riskScoreByNode],
  );
  const variantContexts = useMemo(
    () => getVariantContexts(graph, selectedCommitId),
    [graph, selectedCommitId],
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
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="min-w-0 overflow-hidden border border-[#303240] bg-[#0c0c14] lg:flex-1"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 48% 42%, rgba(36, 45, 64, 0.28) 0%, rgba(12, 12, 20, 0) 62%), linear-gradient(180deg, #0c0c14 0%, #08090f 100%)",
          // React Flow requires an explicit parent height. This clamp preserves
          // a usable canvas on compact viewports and the established 600px
          // desktop composition without relying on generated utility CSS.
          height: "clamp(26rem, 68vh, 37.5rem)",
        }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: "easeOut" }}
      >
        <ReactFlow<CommitFlowNode, TimelineFlowEdge>
          className="bg-transparent"
          colorMode="dark"
          edges={edges}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={FIT_VIEW_OPTIONS}
          nodes={nodes}
          nodesConnectable={false}
          nodesDraggable={false}
          nodeTypes={nodeTypes}
          onNodeClick={(event, node) => {
            event.stopPropagation();
            selectCommit(node.id);
          }}
          onKeyDown={handleFlowKeyDown}
          onPaneClick={() =>
            setSelectedCommitId((current) => (current ? null : current))
          }
          onlyRenderVisibleElements
        >
          <FitGraphInView graph={graph} />
          <Panel
            className="m-3 border border-[#3b3d4c] bg-[#10111a] px-3 py-2 text-xs text-[#f0f0f5] shadow-[inset_0_1px_0_rgba(245,166,35,0.1)]"
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
            {isSampledView ? (
              <p className="mt-1 text-[11px] text-[#a0a0b0]">
                Connected sample of recent commits and Variants
              </p>
            ) : null}
            {commitFocus.kind === "variant" && commitFocus.branchName ? (
              <p
                className="mt-1 max-w-80 text-[11px] text-[#c8d2df]"
                title={`Viewing Variant: ${commitFocus.branchName}. Click canvas to reset.`}
              >
                Viewing Variant: {commitFocus.branchName} · Click canvas to reset
              </p>
            ) : null}
          </Panel>
          <Controls aria-label="Canvas navigation" position="bottom-left" showInteractive={false} />
          <MiniMap<CommitFlowNode>
            ariaLabel="Multiverse overview"
            bgColor="#171724"
            maskColor="rgba(5, 5, 10, 0.35)"
            maskStrokeColor="#f0f0f5"
            maskStrokeWidth={0.75}
            nodeColor={getMiniMapNodeColor}
            nodeStrokeColor="#f0f0f5"
            nodeStrokeWidth={0.75}
            offsetScale={2}
            pannable
            position="bottom-right"
            style={{ height: MINI_MAP_HEIGHT, width: MINI_MAP_WIDTH }}
            zoomable
          />
          <GraphMiniMapOverlay edges={edges} nodes={nodes} />
        </ReactFlow>
      </motion.div>

      <AnimatePresence initial={false}>
        {selectedCommit ? (
          <motion.aside
            animate={{ opacity: 1, x: 0 }}
            aria-live="polite"
            className="w-full border border-[#3b3d4c] bg-[#10111a] p-5 text-[13px] leading-5 text-[#f0f0f5] shadow-[inset_0_1px_0_rgba(245,166,35,0.1)] lg:w-72"
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 6 }}
            initial={shouldReduceMotion ? false : { opacity: 0, x: 6 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.14, ease: "easeOut" }}
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
                  {formatCommitDate(selectedCommit.data.committedDate)}
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
              {variantContexts.length > 0 ? (
                <div className="border-t border-white/10 pt-4">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-[#a0a0b0]">
                    Variant Context
                  </dt>
                  <dd className="mt-2 space-y-3">
                    {variantContexts.map((context, index) => (
                      <VariantContext
                        context={context}
                        key={context.branchName ?? `unnamed-variant-${index}`}
                      />
                    ))}
                  </dd>
                </div>
              ) : null}
            </dl>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function VariantContext({ context }: { context: VariantContextInfo }) {
  return (
    <div className="border-l-2 border-[#22d3ee] pl-3">
      <p
        className="truncate font-medium text-[#f0f0f5]"
        title={context.branchName ?? undefined}
      >
        {context.branchName ?? "Variant name unavailable"}
      </p>
      <p className="mt-0.5 text-xs text-[#a0a0b0]">
        {context.commitsShown} commits shown in this sample
      </p>
      <p className="mt-0.5 text-xs text-[#a0a0b0]">
        {context.connectsToSacredTimeline
          ? "Connected to Sacred Timeline"
          : "Not connected to Sacred Timeline"}
      </p>
      <p className="mt-0.5 text-xs text-[#a0a0b0]">
        Risk level: {formatRiskLevel(context.riskScore)}
      </p>
    </div>
  );
}
