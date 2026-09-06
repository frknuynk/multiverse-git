import type { BranchInfo, MultiverseGraph, MultiverseNode } from "../../types/multiverse.ts";
import { assessVariantRisk, getRiskLevel } from "./risk.ts";

export interface RawCommit {
  oid: string;
  message: string;
  messageHeadline: string;
  committedDate: string;
  url: string;
  author: { name: string; email: string } | null;
  parents: { nodes: Array<{ oid: string }> };
}

export interface RawBranch {
  name: string;
  tipOid: string;
}

/** Build only real parent → child edges. Missing history stays visibly incomplete. */
export function buildDag(
  commits: RawCommit[],
  defaultBranch: RawBranch,
  variants: RawBranch[],
  now = Date.now(),
): MultiverseGraph {
  const byId = new Map(commits.map((commit) => [commit.oid, commit]));
  const sacredIds = firstParentPath(defaultBranch.tipOid, byId);
  const memberships = new Map<string, string[]>();
  const tips = new Set([defaultBranch.tipOid]);
  const branches: BranchInfo[] = [{
    ...defaultBranch, isDefault: true, aheadBy: 0, riskScore: 0, color: "#f5a623",
  }];

  for (const variant of variants) {
    const tip = byId.get(variant.tipOid);
    if (!tip || variant.name === defaultBranch.name || sacredIds.has(tip.oid)) continue;
    const path = firstParentPath(tip.oid, byId, sacredIds);
    for (const id of path) {
      memberships.set(id, [...(memberships.get(id) ?? []), variant.name]);
    }
    const hasSacredBase = [...path].some((id) => {
      const parent = byId.get(id)?.parents.nodes[0]?.oid;
      return parent !== undefined && sacredIds.has(parent);
    });
    const authorCount = new Set([...path].map((id) => byId.get(id)?.author?.email).filter(Boolean)).size;
    const riskScore = assessVariantRisk({
      authorCount, commitsShown: path.size, hasSacredBase,
      tipCommittedDate: tip.committedDate, tipIsMerge: tip.parents.nodes.length > 1,
    }, now).score;
    const level = getRiskLevel(riskScore);
    branches.push({
      ...variant, isDefault: false, aheadBy: path.size, riskScore,
      color: level === "high" ? "#ef4444" : level === "medium" ? "#a78bfa" : "#22d3ee",
    });
    tips.add(tip.oid);
  }

  const risks = new Map(branches.map((branch) => [branch.name, branch.riskScore]));
  const nodes: MultiverseNode[] = [...byId.values()].map((commit) => {
    const isDefaultBranch = sacredIds.has(commit.oid);
    const branchNames = isDefaultBranch ? [defaultBranch.name] : memberships.get(commit.oid) ?? [];
    return {
      id: commit.oid, type: "commit", position: { x: 0, y: 0 },
      data: {
        message: commit.message, headline: commit.messageHeadline,
        author: commit.author ?? { name: "Unknown", email: "" },
        committedDate: commit.committedDate, url: commit.url,
        parents: [...new Set(commit.parents.nodes.map((parent) => parent.oid))],
        branches: branchNames, isDefaultBranch,
        isMerge: commit.parents.nodes.length > 1,
        // Merging Sacred history into an existing Variant does not create a Nexus Event.
        isNexus: !isDefaultBranch && sacredIds.has(commit.parents.nodes[0]?.oid),
        isTip: tips.has(commit.oid),
        riskScore: Math.max(0, ...branchNames.map((name) => risks.get(name) ?? 0)),
      },
    };
  });
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edges: MultiverseGraph["edges"] = nodes.flatMap((node) =>
    node.data.parents.flatMap((parentId, index) => {
      const parent = nodeById.get(parentId);
      if (!parent || parentId === node.id) return [];
      const sacred = index === 0 && node.data.isDefaultBranch && parent.data.isDefaultBranch;
      return [{
        id: `${parentId}-${node.id}`, source: parentId, target: node.id,
        type: sacred ? "sacred"
          : getRiskLevel(Math.max(node.data.riskScore, parent.data.riskScore)) === "high" ? "incursion"
          : node.data.isMerge ? "convergence" : "variant",
      }];
    }),
  );
  return { nodes, edges, branches };
}

function firstParentPath(start: string, commits: Map<string, RawCommit>, stop = new Set<string>()) {
  const path = new Set<string>();
  let id: string | undefined = start;
  while (id && commits.has(id) && !path.has(id) && !stop.has(id)) {
    path.add(id);
    id = commits.get(id)?.parents.nodes[0]?.oid;
  }
  return path;
}
