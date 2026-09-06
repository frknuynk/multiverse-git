"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
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
import {
  COMMIT_NODE_HEIGHT,
  COMMIT_NODE_WIDTH,
} from "@/lib/graph/flow-dimensions";
import { GraphToolbar } from "@/components/graph/GraphToolbar";
import { getRiskLevel, type VariantRiskFactor } from "@/lib/graph/risk";
import { getCommitPresentation } from "@/lib/graph/semantic-zoom";
import {
  getSharedGraphViewUrl,
  type SharedGraphView,
} from "@/lib/graph/shared-graph-view";
import { getTimelinePeek } from "@/lib/graph/timeline-peek";
import {
  getVariantInvestigation,
  type VariantInvestigation as VariantInvestigationInfo,
} from "@/lib/graph/variant-investigation";
import {
  getTimelineBrief,
  type TimelineBrief,
} from "@/lib/graph/timeline-brief";
import { getCommitFocus, getVariantFocus } from "@/lib/graph/commit-focus";
import {
  getInitialTimelineWindowRange,
  getTimelineWindowRangeForCommitIds,
  getTimelineWindow,
  normalizeTimelineWindowRange,
  type TimelineWindowRange,
} from "@/lib/graph/timeline-window";
import {
  getVariantNavigatorItems,
  type VariantNavigatorItem,
} from "@/lib/graph/variant-navigator";
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
const FLOW_NODE_WIDTH = COMMIT_NODE_WIDTH;
const FLOW_NODE_HEIGHT = COMMIT_NODE_HEIGHT;
const EMPTY_SHARED_GRAPH_VIEW: SharedGraphView = { kind: "none" };
// Include declared dimensions so a fit can account for every sampled node even
// while React Flow is virtualizing off-screen elements.
const FULL_GRAPH_FIT_VIEW_OPTIONS = {
  includeHiddenNodes: true,
  maxZoom: 0.9,
  minZoom: 0.05,
  padding: 0.1,
};

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
      className="pointer-events-none hidden sm:block"
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

interface FitGraphInViewProps {
  graph: MultiverseGraph;
  focusedNodeIds: string[];
  isLayoutReady: boolean;
  isFocused: boolean;
  requestId: number;
  shouldReduceMotion: boolean | null;
}

function FitGraphInView({
  focusedNodeIds,
  graph,
  isLayoutReady,
  isFocused,
  requestId,
  shouldReduceMotion,
}: FitGraphInViewProps) {
  const { fitView, viewportInitialized } = useReactFlow<CommitFlowNode>();
  const latestFocus = useRef({ focusedNodeIds, isFocused });

  useEffect(() => {
    latestFocus.current = { focusedNodeIds, isFocused };
  }, [focusedNodeIds, isFocused]);

  useEffect(() => {
    if (!isLayoutReady || !viewportInitialized) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const { focusedNodeIds: currentFocusedNodeIds, isFocused: isCurrentViewFocused } =
        latestFocus.current;

      if (isCurrentViewFocused && currentFocusedNodeIds.length > 0) {
        void fitView({
          duration: shouldReduceMotion ? 0 : 160,
          nodes: currentFocusedNodeIds.map((id) => ({ id })),
          padding: 0.24,
        });
        return;
      }

      void fitView(FULL_GRAPH_FIT_VIEW_OPTIONS);
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [
    fitView,
    graph,
    isLayoutReady,
    requestId,
    shouldReduceMotion,
    viewportInitialized,
  ]);

  return null;
}

interface MultiverseCanvasProps {
  initialGraph: MultiverseGraph;
  repositoryLabel: string;
  initialView?: SharedGraphView;
  isSampled?: boolean;
}

function getInitialSelectedVariantName(
  graph: MultiverseGraph,
  initialView: SharedGraphView,
) {
  if (
    initialView.kind !== "variant" ||
    !graph.branches.some(
      (branch) => !branch.isDefault && branch.name === initialView.branchName,
    )
  ) {
    return null;
  }

  return initialView.branchName;
}

function getInitialTimelineRange(
  graph: MultiverseGraph,
  initialView: SharedGraphView,
) {
  if (initialView.kind === "timeline") {
    const sharedRange = getTimelineWindowRangeForCommitIds(
      graph,
      initialView.startCommitId,
      initialView.endCommitId,
    );

    if (sharedRange) {
      return sharedRange;
    }
  }

  return getInitialTimelineWindowRange(graph);
}

export function MultiverseCanvas({
  initialGraph: graph,
  repositoryLabel,
  initialView = EMPTY_SHARED_GRAPH_VIEW,
  isSampled = false,
}: MultiverseCanvasProps) {
  const isSampledView = isSampled;
  const [selectedCommitId, setSelectedCommitId] = useState<string | null>(null);
  const [hoveredCommitId, setHoveredCommitId] = useState<string | null>(null);
  const [selectedVariantName, setSelectedVariantName] = useState<string | null>(
    () => getInitialSelectedVariantName(graph, initialView),
  );
  const [isVariantNavigatorOpen, setIsVariantNavigatorOpen] = useState(false);
  const [timelineRange, setTimelineRange] = useState<TimelineWindowRange>(() =>
    getInitialTimelineRange(graph, initialView),
  );
  const [viewportRequestId, setViewportRequestId] = useState(0);
  const shouldReduceMotion = useReducedMotion();

  const timelineWindow = useMemo(
    () => getTimelineWindow(graph, timelineRange),
    [graph, timelineRange],
  );
  const isTimelineFocused = !timelineWindow.isFullTimeline;

  const resetTimelineRange = useCallback(() => {
    setTimelineRange({
      endIndex: Math.max(0, timelineWindow.sacredNodeIds.length - 1),
      startIndex: 0,
    });
  }, [timelineWindow.sacredNodeIds.length]);

  const updateSharedGraphView = useCallback((view: SharedGraphView) => {
    const nextUrl = getSharedGraphViewUrl(window.location.href, view);
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, []);

  const selectCommit = useCallback((commitId: string) => {
    setHoveredCommitId(null);
    setIsVariantNavigatorOpen(false);
    setSelectedVariantName(null);
    setSelectedCommitId((current) => (current === commitId ? current : commitId));

    if (selectedVariantName) {
      updateSharedGraphView(EMPTY_SHARED_GRAPH_VIEW);
    }
  }, [selectedVariantName, updateSharedGraphView]);

  const selectVariant = useCallback((branchName: string) => {
    setHoveredCommitId(null);
    setIsVariantNavigatorOpen(false);
    setSelectedCommitId(null);
    setSelectedVariantName(branchName);
    resetTimelineRange();
    setViewportRequestId((current) => current + 1);
    updateSharedGraphView({ branchName, kind: "variant" });
  }, [resetTimelineRange, updateSharedGraphView]);

  const updateTimelineRange = useCallback(
    (boundary: "startIndex" | "endIndex", nextValue: number) => {
      const nextRange = normalizeTimelineWindowRange(
        { ...timelineRange, [boundary]: nextValue },
        timelineWindow.sacredNodeIds.length,
      );

      setHoveredCommitId(null);
      setIsVariantNavigatorOpen(false);
      setSelectedCommitId(null);
      setSelectedVariantName(null);
      setTimelineRange(nextRange);

      const isFullTimeline =
        nextRange.startIndex === 0 &&
        nextRange.endIndex === timelineWindow.sacredNodeIds.length - 1;
      const startCommitId = timelineWindow.sacredNodeIds[nextRange.startIndex];
      const endCommitId = timelineWindow.sacredNodeIds[nextRange.endIndex];

      updateSharedGraphView(
        !startCommitId || !endCommitId || isFullTimeline
          ? EMPTY_SHARED_GRAPH_VIEW
          : { endCommitId, kind: "timeline", startCommitId },
      );
    },
    [timelineRange, timelineWindow.sacredNodeIds, updateSharedGraphView],
  );

  const fitTimelineWindow = useCallback(() => {
    setViewportRequestId((current) => current + 1);
  }, []);

  const resetTimelineWindow = useCallback(() => {
    setHoveredCommitId(null);
    resetTimelineRange();
    setViewportRequestId((current) => current + 1);
    updateSharedGraphView(EMPTY_SHARED_GRAPH_VIEW);
  }, [resetTimelineRange, updateSharedGraphView]);

  const resetTimeline = useCallback(() => {
    const shouldFitFullTimeline = Boolean(
      selectedCommitId || selectedVariantName || isTimelineFocused,
    );

    setIsVariantNavigatorOpen(false);
    setHoveredCommitId(null);
    setSelectedCommitId(null);
    setSelectedVariantName(null);
    resetTimelineRange();
    updateSharedGraphView(EMPTY_SHARED_GRAPH_VIEW);

    if (shouldFitFullTimeline) {
      setViewportRequestId((current) => current + 1);
    }
  }, [
    isTimelineFocused,
    resetTimelineRange,
    selectedCommitId,
    selectedVariantName,
    updateSharedGraphView,
  ]);

  const handlePaneClick = useCallback(
    (event: ReactMouseEvent) => {
      // React Flow can surface clicks from overlay content through its pane
      // callback. Only a direct canvas click should reset the current focus.
      if (event.target !== event.currentTarget) {
        return;
      }

      resetTimeline();
    },
    [resetTimeline],
  );

  const handleFlowKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        setIsVariantNavigatorOpen(false);
        return;
      }

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

  const riskScoreByNode = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node.data.riskScore])),
    [graph.nodes],
  );
  const selectedCommit = useMemo(
    () => graph.nodes.find((node) => node.id === selectedCommitId),
    [graph.nodes, selectedCommitId],
  );
  const hoveredCommit = useMemo(
    () => graph.nodes.find((node) => node.id === hoveredCommitId) ?? null,
    [graph.nodes, hoveredCommitId],
  );
  const commitFocus = useMemo(
    () => getCommitFocus(graph, selectedCommitId),
    [graph, selectedCommitId],
  );
  const selectedVariantFocus = useMemo(
    () => selectedVariantName ? getVariantFocus(graph, selectedVariantName) : null,
    [graph, selectedVariantName],
  );
  const activeFocus = selectedVariantFocus ?? commitFocus;
  const hasCommitFocus = activeFocus.kind !== "none";
  const variantNavigatorItems = useMemo(
    () => getVariantNavigatorItems(graph),
    [graph],
  );
  const selectedVariant = useMemo(
    () =>
      selectedVariantName
        ? variantNavigatorItems.find((item) => item.name === selectedVariantName) ?? null
        : null,
    [selectedVariantName, variantNavigatorItems],
  );
  const variantFocusNodeIds = useMemo(
    () =>
      selectedVariantFocus?.kind === "variant"
        ? Array.from(selectedVariantFocus.emphasizedNodeIds)
        : [],
    [selectedVariantFocus],
  );
  const timelineFocusNodeIds = useMemo(
    () => Array.from(timelineWindow.visibleNodeIds),
    [timelineWindow.visibleNodeIds],
  );
  const focusedNodeIds = selectedVariant
    ? variantFocusNodeIds
    : isTimelineFocused
      ? timelineFocusNodeIds
      : [];

  const nodes = useMemo<CommitFlowNode[]>(
    () =>
      graph.nodes.map((node) => ({
        ariaLabel: node.data.headline,
        id: node.id,
        data: {
          authorName: node.data.author.name,
          headline: node.data.headline,
          isDimmed:
            hasCommitFocus && !activeFocus.emphasizedNodeIds.has(node.id),
          isDefaultBranch: node.data.isDefaultBranch,
          isEmphasized: activeFocus.emphasizedNodeIds.has(node.id),
          isMerge: node.data.isMerge,
          isNexus: node.data.isNexus,
          isTip: node.data.isTip,
          riskScore: node.data.riskScore,
        },
        hidden: !timelineWindow.visibleNodeIds.has(node.id),
        position: node.position,
        selected: node.id === selectedCommitId,
        height: FLOW_NODE_HEIGHT,
        style: { height: FLOW_NODE_HEIGHT, width: FLOW_NODE_WIDTH },
        type: "commit",
        width: FLOW_NODE_WIDTH,
      })),
    [
      activeFocus.emphasizedNodeIds,
      graph.nodes,
      hasCommitFocus,
      selectedCommitId,
      timelineWindow.visibleNodeIds,
    ],
  );

  const edges = useMemo<TimelineFlowEdge[]>(
    () =>
      graph.edges
        .filter((edge) => timelineWindow.visibleEdgeIds.has(edge.id))
        .map((edge) => ({
        data: {
          edgeType: edge.type,
          isEmphasized: activeFocus.emphasizedEdgeIds.has(edge.id),
          isSacred: edge.type === "sacred",
        },
        id: edge.id,
        source: edge.source,
        target: edge.target,
        style: {
          ...getEdgeStyle(edge, riskScoreByNode),
          opacity: hasCommitFocus && !activeFocus.emphasizedEdgeIds.has(edge.id)
            ? edge.type === "sacred"
              ? 0.55
              : 0.28
            : 1,
        },
        type: "timeline",
      })),
    [
      activeFocus.emphasizedEdgeIds,
      graph.edges,
      hasCommitFocus,
      riskScoreByNode,
      timelineWindow.visibleEdgeIds,
    ],
  );
  const visibleNodes = useMemo(
    () => nodes.filter((node) => !node.hidden),
    [nodes],
  );
  const variantContexts = useMemo(
    () => getVariantContexts(graph, selectedCommitId),
    [graph, selectedCommitId],
  );
  const variantInvestigations = useMemo(
    () =>
      variantContexts.flatMap((context) => {
        if (!context.branchName) {
          return [];
        }

        const investigation = getVariantInvestigation(graph, context.branchName);
        return investigation ? [investigation] : [];
      }),
    [graph, variantContexts],
  );
  const timelineBrief = useMemo(() => getTimelineBrief(graph), [graph]);

  return (
    <div className="space-y-2 sm:space-y-3">
      <GraphToolbar graph={graph} repositoryLabel={repositoryLabel} onSelect={(id) => { selectCommit(id); resetTimelineRange(); setViewportRequestId((value) => value + 1); }} />
    <div className="flex flex-col gap-2 sm:gap-4 lg:items-start lg:flex-row">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="min-w-0 overflow-hidden border border-[#393646] bg-[#0c0c14] shadow-[inset_0_0_0_1px_rgba(245,166,35,0.035)] lg:flex-1"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
        style={{
          backgroundImage:
            "radial-gradient(ellipse 62% 46% at 50% 49%, rgba(245,166,35,0.075) 0%, rgba(245,166,35,0) 57%), radial-gradient(ellipse 42% 54% at 11% 18%, rgba(34,211,238,0.06) 0%, rgba(34,211,238,0) 64%), radial-gradient(ellipse 34% 46% at 87% 76%, rgba(167,139,250,0.055) 0%, rgba(167,139,250,0) 68%), linear-gradient(180deg, #0d0e16 0%, #08090f 100%)",
          // React Flow requires an explicit parent height. Keep the phone canvas
          // tall enough for touch exploration before secondary panels appear.
          height: "clamp(30rem, calc(100svh - 15rem), 42rem)",
        }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: "easeOut" }}
      >
        <ReactFlow<CommitFlowNode, TimelineFlowEdge>
          className="bg-transparent"
          colorMode="dark"
          edges={edges}
          edgeTypes={edgeTypes}
          minZoom={FULL_GRAPH_FIT_VIEW_OPTIONS.minZoom}
          nodes={nodes}
          nodesConnectable={false}
          nodesDraggable={false}
          nodeTypes={nodeTypes}
          onNodeClick={(event, node) => {
            event.stopPropagation();
            selectCommit(node.id);
          }}
          onNodeMouseEnter={(_, node) => {
            setHoveredCommitId((current) =>
              current === node.id ? current : node.id,
            );
          }}
          onNodeMouseLeave={(_, node) => {
            setHoveredCommitId((current) =>
              current === node.id ? null : current,
            );
          }}
          onKeyDown={handleFlowKeyDown}
          onPaneClick={handlePaneClick}
          onlyRenderVisibleElements
        >
          <FitGraphInView
            focusedNodeIds={focusedNodeIds}
            graph={graph}
            isLayoutReady
            isFocused={Boolean(selectedVariant) || isTimelineFocused}
            requestId={viewportRequestId}
            shouldReduceMotion={shouldReduceMotion}
          />
          <Panel
            className="m-2 max-w-[calc(100%-1rem)] border border-[#514838] bg-[#10111a]/95 px-2.5 py-2 text-xs text-[#f0f0f5] shadow-[inset_0_1px_0_rgba(245,166,35,0.14)] sm:m-3 sm:px-3"
            onClick={(event) => event.stopPropagation()}
            position="top-left"
          >
            <TimelineBriefing brief={timelineBrief} />
            {isSampledView ? (
              <p className="mt-1 text-[11px] text-[#a0a0b0]">
                {isTimelineFocused
                  ? `Focused window: ${timelineWindow.visibleNodeIds.size} of ${graph.nodes.length} sampled commits`
                  : "Bounded sample · missing ancestry is not shown"}
              </p>
            ) : null}
            {variantNavigatorItems.length > 0 ? (
              <VariantNavigator
                isOpen={isVariantNavigatorOpen}
                items={variantNavigatorItems}
                onSelect={selectVariant}
                onToggle={() => setIsVariantNavigatorOpen((current) => !current)}
              />
            ) : null}
            {selectedVariant ? (
              <VariantFocusSummary
                onReset={resetTimeline}
                variant={selectedVariant}
              />
            ) : commitFocus.kind === "variant" && commitFocus.branchName ? (
              <p
                className="mt-1 max-w-80 text-[11px] text-[#c8d2df]"
                title={`Viewing Variant: ${commitFocus.branchName}. Click canvas to reset.`}
              >
                Viewing Variant: {commitFocus.branchName} · Click canvas to reset
              </p>
            ) : null}
          </Panel>
          <SignalLegend />
          <TimelinePeekPanel commit={hoveredCommit} />
          {timelineWindow.sacredNodeIds.length > 1 ? (
            <TimelineScrubber
              endLabel={getTimelineNodeLabel(
                graph,
                timelineWindow.sacredNodeIds[timelineWindow.endIndex],
              )}
              maxIndex={timelineWindow.sacredNodeIds.length - 1}
              onChange={updateTimelineRange}
              onCommit={fitTimelineWindow}
              onReset={resetTimelineWindow}
              range={timelineWindow}
              startLabel={getTimelineNodeLabel(
                graph,
                timelineWindow.sacredNodeIds[timelineWindow.startIndex],
              )}
            />
          ) : null}
          <Controls
            aria-label="Canvas navigation"
            fitViewOptions={FULL_GRAPH_FIT_VIEW_OPTIONS}
            position="bottom-left"
            showInteractive={false}
          />
          <MiniMap<CommitFlowNode>
            ariaLabel="Multiverse overview"
            bgColor="#171724"
            className="hidden sm:block"
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
          <GraphMiniMapOverlay edges={edges} nodes={visibleNodes} />
        </ReactFlow>
      </motion.div>
      {timelineWindow.sacredNodeIds.length > 1 ? (
        <MobileTimelineControls>
          <TimelineRangeControlContent
            endLabel={getTimelineNodeLabel(
              graph,
              timelineWindow.sacredNodeIds[timelineWindow.endIndex],
            )}
            maxIndex={timelineWindow.sacredNodeIds.length - 1}
            onChange={updateTimelineRange}
            onCommit={fitTimelineWindow}
            onReset={resetTimelineWindow}
            range={timelineWindow}
            startLabel={getTimelineNodeLabel(
              graph,
              timelineWindow.sacredNodeIds[timelineWindow.startIndex],
            )}
          />
        </MobileTimelineControls>
      ) : null}

      <AnimatePresence initial={false}>
        {selectedCommit ? (
          <motion.aside
            animate={{ opacity: 1, x: 0 }}
            aria-live="polite"
            className="fixed inset-x-0 bottom-0 z-40 max-h-[72svh] w-full overflow-y-auto border-t border-[#3b3d4c] bg-[#10111a] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-[13px] leading-5 text-[#f0f0f5] shadow-[0_-18px_40px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(245,166,35,0.1)] lg:static lg:max-h-[68vh] lg:w-72 lg:overflow-y-auto lg:border lg:p-5 lg:shadow-[inset_0_1px_0_rgba(245,166,35,0.1)]"
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 6 }}
            initial={shouldReduceMotion ? false : { opacity: 0, x: 6 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.14, ease: "easeOut" }}
          >
            <div className="sticky top-0 z-10 -mx-4 mb-3 flex items-center justify-between gap-3 border-b border-white/10 bg-[#10111a] px-4 pb-3 lg:static lg:mx-0 lg:block lg:border-0 lg:bg-transparent lg:p-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#aeb6c4] lg:hidden">
                Commit details
              </p>
              <button type="button" className="min-h-10 border border-cyan-400/40 px-3 text-xs text-cyan-200 lg:mb-3 lg:min-h-9 lg:border-0 lg:px-0 lg:text-cyan-300 lg:underline" onClick={() => setSelectedCommitId(null)}>Close</button>
            </div>
            <h2 className="break-words text-sm font-semibold leading-5">
              {selectedCommit.data.headline}
            </h2>
            <p className="mt-2 break-all font-mono text-xs text-[#a0a0b0]">{selectedCommit.id}</p>
            <a className="mt-2 inline-block text-cyan-300 underline" href={selectedCommit.data.url} target="_blank" rel="noopener noreferrer">View commit on GitHub ↗</a>
            <p className="mt-3 whitespace-pre-wrap break-words text-xs text-[#c8d2df]">{selectedCommit.data.message}</p>
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
              <CommitEventContext commit={selectedCommit} />
              {variantInvestigations.length > 0 ? (
                <div className="border-t border-white/10 pt-4">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-[#a0a0b0]">
                    Variant Investigation
                  </dt>
                  <dd className="mt-2 space-y-3">
                    {variantInvestigations.map((investigation) => (
                      <VariantInvestigation
                        investigation={investigation}
                        key={investigation.branchName}
                        selectedCommitId={selectedCommit.id}
                      />
                    ))}
                  </dd>
                </div>
              ) : variantContexts.length > 0 ? (
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
    </div>
  );
}

interface TimelineScrubberProps {
  endLabel: string;
  maxIndex: number;
  onChange: (boundary: "startIndex" | "endIndex", nextValue: number) => void;
  onCommit: () => void;
  onReset: () => void;
  range: TimelineWindowRange & {
    isFullTimeline: boolean;
    visibleNodeIds: Set<string>;
  };
  startLabel: string;
}

function TimelineScrubber({
  endLabel,
  maxIndex,
  onChange,
  onCommit,
  onReset,
  range,
  startLabel,
}: TimelineScrubberProps) {
  return (
    <Panel
      className="m-3 hidden w-80 border border-[#3b3d4c] bg-[#10111a] px-3 py-2 text-[#f0f0f5] shadow-[inset_0_1px_0_rgba(245,166,35,0.1)] sm:block"
      onClick={(event) => event.stopPropagation()}
      position="bottom-center"
    >
      <TimelineRangeControlContent
        endLabel={endLabel}
        maxIndex={maxIndex}
        onChange={onChange}
        onCommit={onCommit}
        onReset={onReset}
        range={range}
        startLabel={startLabel}
      />
    </Panel>
  );
}

function MobileTimelineControls({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-[#3b3d4c] bg-[#10111a] px-3 py-2 text-[#f0f0f5] sm:hidden">
      <button
        aria-expanded={isOpen}
        className="min-h-9 w-full text-left text-xs font-semibold uppercase tracking-wide text-[#d7bd83]"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        Sacred Timeline range
      </button>
      {isOpen ? (
      <div className="mt-2">
        {children}
      </div>
      ) : null}
    </div>
  );
}

function TimelineRangeControlContent({
  endLabel,
  maxIndex,
  onChange,
  onCommit,
  onReset,
  range,
  startLabel,
}: TimelineScrubberProps) {
  const handleKeyUp = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (
      ["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp", "End", "Home", "PageDown", "PageUp"].includes(
        event.key,
      )
    ) {
      onCommit();
    }
  };

  return (
      <section aria-labelledby="sacred-timeline-range-title">
        <div className="flex items-baseline justify-between gap-3">
          <h2
            className="text-[11px] font-semibold uppercase tracking-wide text-[#d7bd83]"
            id="sacred-timeline-range-title"
          >
            Sacred Timeline range
          </h2>
          <output className="shrink-0 text-[11px] text-[#aeb6c4]">
            {range.visibleNodeIds.size} commits in view
          </output>
        </div>
        <p className="mt-1 truncate text-[11px] text-[#aeb6c4]" title={`${startLabel} to ${endLabel}`}>
          {startLabel} → {endLabel}
        </p>
        <div className="mt-2 grid gap-1.5">
          <label className="text-[11px] text-[#c8d2df]" htmlFor="sacred-timeline-start">
            Start commit
          </label>
          <input
            aria-valuetext={startLabel}
            className="h-1.5 w-full accent-[#f5a623]"
            id="sacred-timeline-start"
            max={maxIndex}
            min={0}
            onBlur={onCommit}
            onChange={(event) => onChange("startIndex", Number(event.currentTarget.value))}
            onKeyUp={handleKeyUp}
            onPointerUp={onCommit}
            step={1}
            type="range"
            value={range.startIndex}
          />
          <label className="text-[11px] text-[#c8d2df]" htmlFor="sacred-timeline-end">
            End commit
          </label>
          <input
            aria-valuetext={endLabel}
            className="h-1.5 w-full accent-[#f5a623]"
            id="sacred-timeline-end"
            max={maxIndex}
            min={0}
            onBlur={onCommit}
            onChange={(event) => onChange("endIndex", Number(event.currentTarget.value))}
            onKeyUp={handleKeyUp}
            onPointerUp={onCommit}
            step={1}
            type="range"
            value={range.endIndex}
          />
        </div>
        {!range.isFullTimeline ? (
          <button
            className="mt-2 border border-white/20 px-2 py-1 text-[11px] font-medium text-[#f0f0f5] transition-colors hover:border-[#f5a623]/75 hover:text-[#fff8eb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5a623]"
            onClick={onReset}
            type="button"
          >
            Show full sample
          </button>
        ) : null}
      </section>
  );
}

function getTimelineNodeLabel(graph: MultiverseGraph, nodeId: string | undefined) {
  const node = graph.nodes.find((candidate) => candidate.id === nodeId);

  if (!node) {
    return "Commit unavailable";
  }

  return `${formatCommitDate(node.data.committedDate)} · ${node.data.headline}`;
}

function SignalLegend() {
  const presentation = useStore((state) =>
    getCommitPresentation(state.transform[2]),
  );

  return (
    <Panel
      className="m-3 hidden border border-[#3b3d4c] bg-[#10111a]/95 px-3 py-2 text-[10px] text-[#c8d2df] shadow-[inset_0_1px_0_rgba(34,211,238,0.08)] md:block"
      position="top-right"
    >
      <p className="font-semibold uppercase tracking-[0.12em] text-[#aeb6c4]">
        Timeline signals
      </p>
      <ul
        aria-label="Timeline signal legend"
        className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1"
      >
        <SignalLegendItem colorClass="bg-[#f5a623]" label="Sacred" />
        <SignalLegendItem colorClass="bg-cyan-400" label="Variant" />
        <SignalLegendItem colorClass="bg-violet-400" label="Caution" />
        <SignalLegendItem colorClass="bg-red-500" label="Incursion" />
      </ul>
      {presentation === "overview" ? (
        <p className="mt-2 border-t border-white/10 pt-1.5 text-[10px] text-[#aeb6c4]">
          Overview mode · Zoom in to inspect commits
        </p>
      ) : null}
    </Panel>
  );
}

function TimelinePeekPanel({
  commit,
}: {
  commit: MultiverseGraph["nodes"][number] | null;
}) {
  const presentation = useStore((state) =>
    getCommitPresentation(state.transform[2]),
  );

  if (!commit || presentation !== "overview") {
    return null;
  }

  const peek = getTimelinePeek(commit);
  const signal = peek.isDefaultBranch
    ? "Sacred Timeline"
    : peek.eventLabel ?? "Variant";
  const accentClass = peek.isDefaultBranch
    ? "border-[#f5a623]/70 text-[#f8cd72]"
    : peek.riskLevel === "high"
      ? "border-red-400/70 text-red-300"
      : peek.riskLevel === "medium"
        ? "border-violet-400/70 text-violet-200"
        : "border-cyan-400/70 text-cyan-100";
  const showRisk = !peek.isDefaultBranch && peek.riskLevel !== "healthy";

  return (
    <Panel
      aria-label="Commit preview"
      className="pointer-events-none m-3 max-w-80 border border-[#3b3d4c] bg-[#10111a]/95 px-3 py-2 text-[#f0f0f5] shadow-[inset_0_1px_0_rgba(34,211,238,0.08)]"
      position="top-center"
    >
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em]">
        <span className={`border-l-2 pl-1.5 ${accentClass}`}>{signal}</span>
        {showRisk ? (
          <span className={peek.riskLevel === "high" ? "text-red-300" : "text-violet-200"}>
            Risk {peek.riskScore}
          </span>
        ) : null}
      </div>
      <p className="mt-1 truncate text-sm font-semibold leading-4" title={peek.headline}>
        {peek.headline}
      </p>
      <p className="mt-1 truncate text-[11px] text-[#aeb6c4]" title={peek.authorName}>
        {peek.authorName} · Click to inspect
      </p>
    </Panel>
  );
}

function SignalLegendItem({
  colorClass,
  label,
}: {
  colorClass: string;
  label: string;
}) {
  return (
    <li className="flex items-center gap-1.5 whitespace-nowrap">
      <span aria-hidden="true" className={`h-1.5 w-3 ${colorClass}`} />
      <span>{label}</span>
    </li>
  );
}

function TimelineBriefing({ brief }: { brief: TimelineBrief }) {
  const status = getTimelineStatusPresentation(brief);

  return (
    <section aria-label="Timeline briefing">
      <div className="flex items-center gap-3">
        <span>
          <strong className="font-semibold">{brief.commitCount}</strong> commits
        </span>
        <span className="h-3 border-l border-white/15" />
        <span>
          <strong className="font-semibold">{brief.variantCount}</strong> Variants
        </span>
      </div>
      <p className={`mt-1 flex items-center gap-1.5 text-[11px] ${status.textClass}`}>
        <span aria-hidden="true" className={`h-1.5 w-1.5 ${status.dotClass}`} />
        {status.label}
      </p>
      <dl className="mt-2 hidden grid-cols-3 gap-2 border-t border-white/10 pt-2 text-[10px] sm:grid">
        <TimelineMetric label="Nexus" value={brief.nexusEventCount} />
        <TimelineMetric label="Convergence" value={brief.convergenceCount} />
        <TimelineMetric
          label="Incursion"
          value={brief.incursionVariantCount}
        />
      </dl>
    </section>
  );
}

function TimelineMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="uppercase tracking-wide text-[#7f8796]">{label}</dt>
      <dd className="mt-0.5 font-mono text-xs font-semibold text-[#f0f0f5]">{value}</dd>
    </div>
  );
}

function getTimelineStatusPresentation(brief: TimelineBrief) {
  if (brief.status === "incursion") {
    return {
      dotClass: "bg-red-500",
      label: `${brief.incursionVariantCount} Unstable Variant${brief.incursionVariantCount === 1 ? "" : "s"} detected`,
      textClass: "text-red-300",
    };
  }

  if (brief.status === "monitoring") {
    return {
      dotClass: "bg-violet-400",
      label: `${brief.cautionVariantCount} Variant${brief.cautionVariantCount === 1 ? "" : "s"} under observation`,
      textClass: "text-violet-200",
    };
  }

  return {
    dotClass: "bg-cyan-400",
    label: "Temporal field stable",
    textClass: "text-cyan-100",
  };
}

function CommitEventContext({
  commit,
}: {
  commit: MultiverseGraph["nodes"][number];
}) {
  const signals = [
    commit.data.isNexus
      ? {
          label: "Nexus Event",
          text: "This sampled commit begins a Variant from the Sacred Timeline.",
        }
      : null,
    commit.data.isMerge
      ? {
          label: "Convergence",
          text: "This merge commit joins multiple sampled histories.",
        }
      : null,
    commit.data.isTip
      ? {
          label: "Active tip",
          text: "This is a current branch tip in the sampled graph.",
        }
      : null,
  ].filter((signal): signal is { label: string; text: string } => Boolean(signal));

  if (signals.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-white/10 pt-4">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-[#a0a0b0]">
        Timeline Event
      </dt>
      <dd className="mt-2 space-y-2">
        {signals.map((signal) => (
          <div className="border-l-2 border-[#f5a623] pl-3" key={signal.label}>
            <p className="text-xs font-medium text-[#f4d18b]">{signal.label}</p>
            <p className="mt-0.5 text-xs text-[#aeb6c4]">{signal.text}</p>
          </div>
        ))}
      </dd>
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

function VariantInvestigation({
  investigation,
  selectedCommitId,
}: {
  investigation: VariantInvestigationInfo;
  selectedCommitId: string;
}) {
  const riskFactors = investigation.riskFactors;

  return (
    <div className="border-l-2 border-violet-400 pl-3">
      <p
        className="truncate text-xs font-medium text-[#f0f0f5]"
        title={investigation.branchName}
      >
        {investigation.branchName}
      </p>
      <p className="mt-0.5 text-xs text-[#aeb6c4]">
        {investigation.commitsShown} commits shown · {investigation.connectsToSacredTimeline
          ? "Connected to Sacred Timeline"
          : "Not connected to Sacred Timeline"}
      </p>
      <p className="mt-1 text-xs font-medium text-[#f0f0f5]">
        Risk {investigation.riskScore} · {formatRiskLevel(investigation.riskScore)}
      </p>
      <div className="mt-2 space-y-1.5 text-xs text-[#aeb6c4]">
        {investigation.nexusEvent && investigation.nexusEvent.id !== selectedCommitId ? (
          <InvestigationFact
            label="Nexus Event"
            value={investigation.nexusEvent.headline}
          />
        ) : null}
        {investigation.convergence && investigation.convergence.id !== selectedCommitId ? (
          <InvestigationFact
            label="Convergence"
            value={investigation.convergence.headline}
          />
        ) : null}
      </div>
      <ul className="mt-2 space-y-1.5 text-xs text-[#aeb6c4]">
        {riskFactors.map((factor) => (
          <li className="flex gap-1.5" key={factor.kind}>
            <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 bg-violet-400" />
            <span>{formatRiskFactor(factor, investigation)}</span>
          </li>
        ))}
        {riskFactors.length === 0 ? (
          <li>
            No elevated risk signals in this visible sample.
          </li>
        ) : null}
      </ul>
      {!investigation.scoreMatchesCurrentGraph ? (
        <p className="mt-2 text-[11px] leading-4 text-[#7f8796]">
          Signals are reconstructed from the current sample; the source score was
          calculated when this sample was built.
        </p>
      ) : null}
    </div>
  );
}

function InvestigationFact({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-[#7f8796]">{label}: </span>
      <span className="text-[#c8d2df]">{value}</span>
    </p>
  );
}

function formatRiskFactor(
  factor: VariantRiskFactor,
  investigation: VariantInvestigationInfo,
) {
  switch (factor.kind) {
    case "divergence":
      return `${investigation.commitsAhead} commits in the sampled first-parent path`;
    case "staleness":
      return `Last sampled tip is ${investigation.tipAgeInDays ?? "an unknown number of"} days old`;
    case "incomplete-history":
      return "Sacred Timeline base was not reached in the first-parent sample";
    case "author-spread":
      return `${investigation.contributorsShown} contributors appear in this Variant sample`;
    case "merge-tip":
      return "Active Variant tip is a merge commit";
    case "unstable-variant":
      return "Bounded history cap reached with a long-idle Variant tip";
  }
}

interface VariantNavigatorProps {
  isOpen: boolean;
  items: VariantNavigatorItem[];
  onSelect: (branchName: string) => void;
  onToggle: () => void;
}

function VariantNavigator({
  isOpen,
  items,
  onSelect,
  onToggle,
}: VariantNavigatorProps) {
  return (
    <div className="relative mt-2">
      <button
        aria-controls="variant-navigator-menu"
        aria-expanded={isOpen}
        className="border border-cyan-400/45 px-2 py-1 text-[11px] font-medium text-[#d9f8ff] transition-colors hover:border-cyan-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
        onClick={onToggle}
        type="button"
      >
        Explore Variants <span className="text-cyan-300">{items.length}</span>
      </button>
      {isOpen ? (
        <div
          className="absolute left-0 top-full z-20 mt-1 w-[min(20rem,calc(100vw-2rem))] border border-[#3b3d4c] bg-[#10111a] p-1 shadow-[inset_0_1px_0_rgba(245,166,35,0.1)] sm:left-full sm:top-0 sm:mt-0 sm:ml-2 sm:max-h-52 sm:w-64 sm:overflow-y-auto"
          id="variant-navigator-menu"
          role="menu"
        >
          {items.map((item) => (
            <button
              className="block w-full border border-transparent px-2 py-2 text-left transition-colors hover:border-cyan-400/50 hover:bg-[#151a24] focus-visible:border-cyan-300 focus-visible:outline-none"
              key={item.name}
              onClick={() => onSelect(item.name)}
              role="menuitem"
              type="button"
            >
              <span className="block truncate text-xs font-medium text-[#f0f0f5]" title={item.name}>
                {item.name}
              </span>
              <span className="mt-0.5 block text-[11px] text-[#aeb6c4]">
                <span className={getRiskTextClass(item.riskScore)}>
                  {formatRiskLevel(item.riskScore)} · Risk {item.riskScore}
                </span>
                <span> · {item.commitsShown} commits</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function VariantFocusSummary({
  onReset,
  variant,
}: {
  onReset: () => void;
  variant: VariantNavigatorItem;
}) {
  return (
    <div className="mt-2 border-t border-white/10 pt-2 text-[11px] text-[#c8d2df]">
      <p className="truncate font-medium text-[#f0f0f5]" title={variant.name}>
        Viewing Variant: {variant.name}
      </p>
      <p className="mt-0.5">
        {variant.commitsShown} commits shown · {variant.connectsToSacredTimeline
          ? "Connected to Sacred Timeline"
          : "Not connected to Sacred Timeline"} · {formatRiskLevel(variant.riskScore)}
      </p>
      <button
        className="mt-2 border border-white/20 px-2 py-1 text-[11px] font-medium text-[#f0f0f5] transition-colors hover:border-[#f5a623]/75 hover:text-[#fff8eb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5a623]"
        onClick={onReset}
        type="button"
      >
        Return to full timeline
      </button>
    </div>
  );
}

function getRiskTextClass(riskScore: number) {
  const riskLevel = getRiskLevel(riskScore);

  if (riskLevel === "high") {
    return "text-red-400";
  }

  if (riskLevel === "medium") {
    return "text-violet-300";
  }

  return "text-cyan-300";
}
