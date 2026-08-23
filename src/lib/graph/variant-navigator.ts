import { getNodesConnectedToSacredTimeline } from "./graph-connectivity.ts";
import { getRiskLevel } from "./risk.ts";
import type { MultiverseGraph } from "@/types/multiverse";

export interface VariantNavigatorItem {
  name: string;
  tipOid: string;
  commitsShown: number;
  connectsToSacredTimeline: boolean;
  riskScore: number;
}

const riskPriority = {
  high: 0,
  medium: 1,
  healthy: 2,
} as const;

export function getVariantNavigatorItems(
  graph: MultiverseGraph,
): VariantNavigatorItem[] {
  const connectedNodeIds = getNodesConnectedToSacredTimeline(graph);
  const commitsShownByBranch = getCommitsShownByBranch(graph);

  return graph.branches
    .filter((branch) => !branch.isDefault)
    .map((branch) => ({
      name: branch.name,
      tipOid: branch.tipOid,
      commitsShown: commitsShownByBranch.get(branch.name) ?? 0,
      connectsToSacredTimeline: connectedNodeIds.has(branch.tipOid),
      riskScore: branch.riskScore,
    }))
    .filter((branch) => branch.commitsShown > 0)
    .sort(compareVariantNavigatorItems);
}

function getCommitsShownByBranch(graph: MultiverseGraph) {
  const commitsShownByBranch = new Map<string, number>();

  for (const node of graph.nodes) {
    for (const branchName of node.data.branches) {
      commitsShownByBranch.set(
        branchName,
        (commitsShownByBranch.get(branchName) ?? 0) + 1,
      );
    }
  }

  return commitsShownByBranch;
}

function compareVariantNavigatorItems(
  left: VariantNavigatorItem,
  right: VariantNavigatorItem,
) {
  const riskDifference =
    riskPriority[getRiskLevel(left.riskScore)] -
    riskPriority[getRiskLevel(right.riskScore)];

  if (riskDifference !== 0) {
    return riskDifference;
  }

  if (left.riskScore !== right.riskScore) {
    return right.riskScore - left.riskScore;
  }

  if (left.commitsShown !== right.commitsShown) {
    return right.commitsShown - left.commitsShown;
  }

  return left.name.localeCompare(right.name);
}
