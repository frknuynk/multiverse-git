import { memo } from "react";
import {
  BaseEdge,
  getBezierPath,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";

export interface TimelineEdgeData extends Record<string, unknown> {
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
  const [edgePath] = getBezierPath({
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
  const shouldBloom = data?.isSacred || data?.isEmphasized;
  const bloomOpacity = data?.isEmphasized ? 0.2 : 0.16;

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
        style={{ ...style, strokeLinecap: "round" }}
      />
    </>
  );
});
