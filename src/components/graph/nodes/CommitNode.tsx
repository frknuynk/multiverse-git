import { memo } from "react";
import {
  Handle,
  Position,
  useStore,
  type Node,
  type NodeProps,
} from "@xyflow/react";

import { getRiskLevel } from "@/lib/graph/risk";
import { getCommitPresentation } from "@/lib/graph/semantic-zoom";

export interface CommitNodeData extends Record<string, unknown> {
  headline: string;
  authorName: string;
  isDimmed: boolean;
  isDefaultBranch: boolean;
  isEmphasized: boolean;
  isMerge: boolean;
  isNexus: boolean;
  isTip: boolean;
  riskScore: number;
}

export type CommitFlowNode = Node<CommitNodeData, "commit">;

export const CommitNode = memo(function CommitNode({
  data,
  selected,
}: NodeProps<CommitFlowNode>) {
  const presentation = useStore((state) =>
    getCommitPresentation(state.transform[2]),
  );
  const riskLevel = getRiskLevel(data.riskScore);
  const isHighRisk = riskLevel === "high";
  const isOverview = presentation === "overview";
  const eventLabel = data.isMerge
    ? "Convergence"
    : data.isNexus
      ? "Nexus Event"
      : data.isTip
        ? "Active tip"
        : null;
  const backgroundClass = data.isDimmed
    ? "bg-[#0c0e14]"
    : data.isEmphasized || selected
      ? "bg-[#171d29]"
      : data.isDefaultBranch
        ? "bg-[#15130f]"
        : "bg-[#10151e]";
  const borderClass = data.isDefaultBranch
    ? "border-[#f5a623]"
    : isHighRisk
      ? "border-red-500"
      : riskLevel === "medium"
        ? "border-violet-400/90"
        : "border-cyan-400/90";
  const ambientRimClass = selected
    ? "ring-2 ring-[#f7d48a]/80 ring-offset-1 ring-offset-[#08090e]"
    : data.isEmphasized
      ? "ring-1 ring-white/35"
      : data.isDefaultBranch
        ? "shadow-[0_0_10px_rgba(245,166,35,0.16)]"
        : isHighRisk
          ? "shadow-[0_0_10px_rgba(239,68,68,0.14)]"
          : "";
  const signalClass = data.isDefaultBranch
    ? "bg-[#f5a623]"
    : isHighRisk
      ? "bg-red-500"
      : riskLevel === "medium"
        ? "bg-violet-400"
        : "bg-cyan-400";
  const eventClass = data.isMerge
    ? "border-[#f5a623]/45 bg-[#f5a623]/10 text-[#f8cd72]"
    : data.isNexus
      ? "border-cyan-400/45 bg-cyan-400/10 text-cyan-200"
      : "border-white/15 bg-white/[0.04] text-[#aeb6c4]";
  const handleClass = data.isDefaultBranch
    ? "!bg-[#d8901f]"
    : riskLevel === "medium"
      ? "!bg-violet-400"
      : isHighRisk
        ? "!bg-red-500"
        : "!bg-cyan-400";

  if (isOverview) {
    const markerClass = data.isDefaultBranch
      ? "h-2 w-5 rounded-sm"
      : data.isNexus
        ? "h-3.5 w-3.5 rotate-45"
        : data.isMerge
          ? "h-3.5 w-3.5 rounded-sm"
          : "h-3 w-3 rounded-full";
    const markerRingClass = selected
      ? "ring-2 ring-[#f7d48a] ring-offset-1 ring-offset-[#08090e]"
      : data.isEmphasized
        ? "ring-1 ring-white/70"
        : "";

    return (
      <div className={`relative h-full w-full ${data.isDimmed ? "opacity-55" : ""}`}>
        <Handle
          className={`!h-2 !w-2 !border-0 !opacity-0 ${handleClass}`}
          position={Position.Left}
          type="target"
        />
        <span
          aria-hidden="true"
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border ${markerClass} ${borderClass} ${signalClass} ${markerRingClass}`}
        />
        <Handle
          className={`!h-2 !w-2 !border-0 !opacity-0 ${handleClass}`}
          position={Position.Right}
          type="source"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative w-full overflow-hidden rounded-[3px] border px-3 py-2 text-[#f0f0f5] transition-colors duration-150 ease-out motion-reduce:transition-none ${backgroundClass} ${borderClass} ${ambientRimClass}`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-0.5 ${signalClass}`}
      />
      <Handle
        className={`!h-2 !w-2 !border-0 ${handleClass}`}
        position={Position.Left}
        type="target"
      />
      <div className="flex min-w-0 items-center gap-1.5">
        {eventLabel ? (
          <span
            className={`shrink-0 border px-1 py-px text-[8px] font-semibold uppercase tracking-[0.1em] ${eventClass}`}
            title={eventLabel}
          >
            {eventLabel}
          </span>
        ) : null}
        <p className="min-w-0 truncate text-sm font-semibold leading-4 tracking-tight" title={data.headline}>
          {data.headline}
        </p>
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-[11px] leading-3">
        <p className="min-w-0 truncate font-mono text-[#aeb6c4]" title={data.authorName}>
          {data.authorName}
        </p>
        {isHighRisk ? (
          <span className="shrink-0 font-medium text-red-400">
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
