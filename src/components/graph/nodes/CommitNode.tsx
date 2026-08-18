import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

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
  const isHighRisk = data.riskScore >= 60;
  const backgroundClass = data.isDefaultBranch ? "bg-[#fff8eb]" : "bg-[#f4fcff]";
  const borderClass = selected
    ? "border-2 border-[#f5a623]"
    : data.isDefaultBranch
      ? "border-[#f5a623]"
      : "border-cyan-400";

  return (
    <div className={`w-full border px-3 py-2 text-zinc-900 ${backgroundClass} ${borderClass}`}>
      <Handle
        className="!h-2 !w-2 !border-0 !bg-zinc-500"
        position={Position.Left}
        type="target"
      />
      <p className="truncate text-sm font-medium" title={data.headline}>
        {data.headline}
      </p>
      <div className="mt-1 flex items-center gap-2 text-xs">
        <p className="min-w-0 truncate text-zinc-500" title={data.authorName}>
          {data.authorName}
        </p>
        {isHighRisk ? (
          <span className="shrink-0 font-medium text-red-600">
            Risk {data.riskScore}
          </span>
        ) : null}
      </div>
      <Handle
        className="!h-2 !w-2 !border-0 !bg-zinc-500"
        position={Position.Right}
        type="source"
      />
    </div>
  );
});
