import { memo } from "react";
import {
  BaseEdge,
  getBezierPath,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";

import type { MultiverseEdgeType } from "@/types/multiverse";

export interface TimelineEdgeData extends Record<string, unknown> {
  edgeType: MultiverseEdgeType;
  isEmphasized: boolean;
  isSacred: boolean;
}

export type TimelineFlowEdge = Edge<TimelineEdgeData, "timeline">;

export const TimelineEdge = memo(function TimelineEdge({
  data,
  markerEnd,
  markerStart,
  sourcePosition,
  sourceX,
  sourceY,
  style,
  targetPosition,
  targetX,
  targetY,
}: EdgeProps<TimelineFlowEdge>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourcePosition,
    sourceX,
    sourceY,
    targetPosition,
    targetX,
    targetY,
  });
  const stroke = typeof style?.stroke === "string" ? style.stroke : "#22d3ee";
  const strokeWidth = typeof style?.strokeWidth === "number"
    ? style.strokeWidth
    : 1.5;
  const visualOpacity = typeof style?.opacity === "number" ? style.opacity : 1;
  const isConvergence = data?.edgeType === "convergence";
  const isIncursion = data?.edgeType === "incursion";
  const shouldBloom = data?.isSacred || data?.isEmphasized || isConvergence;
  const bloomOpacity = data?.isEmphasized ? 0.2 : data?.isSacred ? 0.16 : 0.1;

  return (
    <>
      {shouldBloom ? (
        <path
          d={edgePath}
          fill="none"
          pointerEvents="none"
          stroke={stroke}
          strokeLinecap="round"
          strokeOpacity={bloomOpacity * visualOpacity}
          strokeWidth={strokeWidth + 4}
        />
      ) : null}
      <BaseEdge
        markerEnd={markerEnd}
        markerStart={markerStart}
        path={edgePath}
        style={{
          ...style,
          strokeDasharray: isIncursion ? "5 3" : style?.strokeDasharray,
          strokeLinecap: "round",
        }}
      />
      {isConvergence ? (
        <circle
          cx={labelX}
          cy={labelY}
          fill="#08090e"
          r={3}
          stroke={stroke}
          strokeOpacity={visualOpacity}
          strokeWidth={1.25}
        />
      ) : null}
    </>
  );
});
