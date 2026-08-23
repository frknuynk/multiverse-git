import { getRiskLevel, type RiskLevel } from "./risk.ts";
import type { MultiverseNode } from "../../types/multiverse.ts";

export type TimelineEventLabel =
  | "Active tip"
  | "Convergence"
  | "Nexus Event"
  | null;

export interface TimelinePeek {
  authorName: string;
  eventLabel: TimelineEventLabel;
  headline: string;
  isDefaultBranch: boolean;
  riskLevel: RiskLevel;
  riskScore: number;
}

export function getTimelinePeek(node: MultiverseNode): TimelinePeek {
  return {
    authorName: node.data.author.name,
    eventLabel: node.data.isMerge
      ? "Convergence"
      : node.data.isNexus
        ? "Nexus Event"
        : node.data.isTip
          ? "Active tip"
          : null,
    headline: node.data.headline,
    isDefaultBranch: node.data.isDefaultBranch,
    riskLevel: getRiskLevel(node.data.riskScore),
    riskScore: node.data.riskScore,
  };
}
