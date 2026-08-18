import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

import { getRiskLevel } from "@/lib/graph/risk";

export interface CommitNodeData extends Record<string, unknown> {
  headline: string;
  authorName: string;
  isDefaultBranch: boolean;
  riskScore: number;
}

export type CommitFlowNode = Node<CommitNodeData, "commit">;

export const CommitNode = memo(function CommitNode({
  data,
  selected,
}: NodeProps<CommitFlowNode>) {
  const riskLevel = getRiskLevel(data.riskScore);
  const isHighRisk = riskLevel === "high";
  const backgroundClass = data.isDefaultBranch
    ? "bg-[#fff8eb]"
    : riskLevel === "medium"
      ? "bg-[#faf7ff]"
      : "bg-[#f4fcff]";
  const borderClass = selected
    ? "border-2 border-[#f5a623]"
    : data.isDefaultBranch
      ? "border-[#f5a623]"
      : riskLevel === "medium"
        ? "border-violet-400"
        : "border-cyan-400";
  const handleClass = data.isDefaultBranch
    ? "!bg-[#d8901f]"
    : riskLevel === "medium"
      ? "!bg-violet-400"
      : isHighRisk
        ? "!bg-red-500"
        : "!bg-cyan-400";

  return (
    <div
      className={`w-full rounded-sm border px-3 py-2 text-zinc-900 ${backgroundClass} ${borderClass}`}
    >
      <Handle
        className={`!h-2 !w-2 !border-0 ${handleClass}`}
        position={Position.Left}
        type="target"
      />
      <p className="truncate text-sm font-semibold leading-4 tracking-tight" title={data.headline}>
        {data.headline}
      </p>
      <div className="mt-1 flex items-center gap-2 text-[11px] leading-3">
        <p className="min-w-0 truncate text-zinc-600" title={data.authorName}>
          {data.authorName}
        </p>
        {isHighRisk ? (
          <span className="shrink-0 font-medium text-red-600">
            Risk {data.riskScore}
          </span>
        ) : null}
      </div>
      <Handle
        className={`!h-2 !w-2 !border-0 ${handleClass}`}
        position={Position.Right}
        type="source"
      />
    </div>
  );
});
