import { getRiskLevel, type RiskLevel } from "./risk.ts";
import type { MultiverseGraph } from "../../types/multiverse.ts";

export interface TimelineBrief {
  cautionVariantCount: number;
  commitCount: number;
  convergenceCount: number;
  healthyVariantCount: number;
  incursionVariantCount: number;
  nexusEventCount: number;
  sacredCommitCount: number;
  status: TimelineStatus;
  variantCount: number;
}

export type TimelineStatus = "incursion" | "monitoring" | "stable";

export function getTimelineBrief(graph: MultiverseGraph): TimelineBrief {
  const variantBranches = graph.branches.filter((branch) => !branch.isDefault);
  const variantsByRisk = countVariantsByRisk(variantBranches.map((branch) => branch.riskScore));
  const incursionVariantCount = variantsByRisk.high;
  const cautionVariantCount = variantsByRisk.medium;

  return {
    cautionVariantCount,
    commitCount: graph.nodes.length,
    convergenceCount: graph.nodes.filter((node) => node.data.isMerge).length,
    healthyVariantCount: variantsByRisk.healthy,
    incursionVariantCount,
    nexusEventCount: graph.nodes.filter((node) => node.data.isNexus).length,
    sacredCommitCount: graph.nodes.filter((node) => node.data.isDefaultBranch).length,
    status:
      incursionVariantCount > 0
        ? "incursion"
        : cautionVariantCount > 0
          ? "monitoring"
          : "stable",
    variantCount: variantBranches.length,
  };
}

function countVariantsByRisk(riskScores: number[]): Record<RiskLevel, number> {
  return riskScores.reduce<Record<RiskLevel, number>>(
    (counts, riskScore) => {
      counts[getRiskLevel(riskScore)] += 1;
      return counts;
    },
    { healthy: 0, high: 0, medium: 0 },
  );
}
