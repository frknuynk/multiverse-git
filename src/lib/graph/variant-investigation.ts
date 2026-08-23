import { getNodesConnectedToSacredTimeline } from "./graph-connectivity.ts";
import {
  assessVariantRisk,
  getRiskLevel,
  type RiskLevel,
  type VariantRiskFactor,
} from "./risk.ts";
import type { MultiverseGraph, MultiverseNode } from "../../types/multiverse.ts";

export interface VariantInvestigation {
  branchName: string;
  commitsAhead: number;
  commitsShown: number;
  connectsToSacredTimeline: boolean;
  convergence: CommitReference | null;
  contributorsShown: number;
  hasSacredBase: boolean;
  nexusEvent: CommitReference | null;
  riskFactors: VariantRiskFactor[];
  riskLevel: RiskLevel;
  riskScore: number;
  scoreMatchesCurrentGraph: boolean;
  tip: CommitReference | null;
  tipAgeInDays: number | null;
}

export interface CommitReference {
  headline: string;
  id: string;
}

/**
 * Produces an inspectable Variant-level view using only visible nodes, real
 * edges, and the already-enriched branch score. It never follows missing
 * history or assumes an unseen Convergence.
 */
export function getVariantInvestigation(
  graph: MultiverseGraph,
  branchName: string,
  now = Date.now(),
): VariantInvestigation | null {
  const branch = graph.branches.find(
    (candidate) => candidate.name === branchName && !candidate.isDefault,
  );

  if (!branch) {
    return null;
  }

  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const sacredNodeIds = new Set(
    graph.nodes
      .filter((node) => node.data.isDefaultBranch)
      .map((node) => node.id),
  );
  const variantNodes = graph.nodes.filter((node) =>
    node.data.branches.includes(branch.name),
  );
  const variantNodeIds = new Set(variantNodes.map((node) => node.id));
  const tip = nodesById.get(branch.tipOid) ?? null;
  const nexusEvent = variantNodes.find((node) => node.data.isNexus) ?? null;
  const convergence = findConvergence(graph, variantNodeIds, nodesById);
  const hasSacredBase = graph.edges.some(
    (edge) =>
      sacredNodeIds.has(edge.source) && variantNodeIds.has(edge.target),
  );
  const contributorsShown = new Set(
    variantNodes
      .map((node) => node.data.author.email.trim())
      .filter(Boolean),
  ).size;
  const riskAssessment = tip
    ? assessVariantRisk(
        {
          authorCount: contributorsShown,
          commitsShown: branch.aheadBy,
          hasSacredBase,
          tipCommittedDate: tip.data.committedDate,
          tipIsMerge: tip.data.isMerge,
        },
        now,
      )
    : null;

  return {
    branchName: branch.name,
    commitsAhead: branch.aheadBy,
    commitsShown: variantNodes.length,
    connectsToSacredTimeline: getNodesConnectedToSacredTimeline(graph).has(
      branch.tipOid,
    ),
    convergence: convergence ? toCommitReference(convergence) : null,
    contributorsShown,
    hasSacredBase,
    nexusEvent: nexusEvent ? toCommitReference(nexusEvent) : null,
    riskFactors: riskAssessment?.factors ?? [],
    riskLevel: getRiskLevel(branch.riskScore),
    riskScore: branch.riskScore,
    scoreMatchesCurrentGraph: riskAssessment?.score === branch.riskScore,
    tip: tip ? toCommitReference(tip) : null,
    tipAgeInDays: riskAssessment?.ageInDays ?? null,
  };
}

function findConvergence(
  graph: MultiverseGraph,
  variantNodeIds: Set<string>,
  nodesById: Map<string, MultiverseNode>,
): MultiverseNode | null {
  for (const edge of graph.edges) {
    if (!variantNodeIds.has(edge.source)) {
      continue;
    }

    const target = nodesById.get(edge.target);
    if (target?.data.isDefaultBranch && target.data.isMerge) {
      return target;
    }
  }

  return null;
}

function toCommitReference(node: MultiverseNode): CommitReference {
  return { headline: node.data.headline, id: node.id };
}
