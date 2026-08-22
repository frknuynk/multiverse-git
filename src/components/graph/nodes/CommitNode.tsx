import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

import { getRiskLevel } from "@/lib/graph/risk";

export interface CommitNodeData extends Record<string, unknown> {
  headline: string;
  authorName: string;
  isDimmed: boolean;
  isDefaultBranch: boolean;
  isEmphasized: boolean;
  riskScore: number;
}

export type CommitFlowNode = Node<CommitNodeData, "commit">;

export const CommitNode = memo(function CommitNode({
  data,
  selected,
}: NodeProps<CommitFlowNode>) {
  const riskLevel = getRiskLevel(data.riskScore);
  const isHighRisk = riskLevel === "high";
  const backgroundClass = data.isDimmed
    ? "bg-[#0c0e14]"
    : data.isEmphasized || selected
      ? "bg-[#151a24]"
      : "bg-[#11141d]";
  const borderClass = data.isDefaultBranch
    ? "border-[#f5a623]/85"
    : isHighRisk
      ? "border-red-500/85"
      : riskLevel === "medium"
        ? "border-violet-400/85"
        : "border-cyan-400/85";
  const ambientRimClass = selected
    ? "ring-2 ring-[#f7d48a]/80 ring-offset-1 ring-offset-[#08090e]"
    : data.isEmphasized
      ? "ring-1 ring-white/35"
      : data.isDefaultBranch
        ? "shadow-[0_0_10px_rgba(245,166,35,0.16)]"
        : isHighRisk
          ? "shadow-[0_0_10px_rgba(239,68,68,0.14)]"
          : "";
  const handleClass = data.isDefaultBranch
    ? "!bg-[#d8901f]"
    : riskLevel === "medium"
      ? "!bg-violet-400"
      : isHighRisk
        ? "!bg-red-500"
        : "!bg-cyan-400";

  return (
    <div
      className={`w-full rounded-sm border px-3 py-2 text-[#f0f0f5] transition-colors duration-150 ease-out motion-reduce:transition-none ${backgroundClass} ${borderClass} ${ambientRimClass}`}
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
        <p className="min-w-0 truncate text-[#aeb6c4]" title={data.authorName}>
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
