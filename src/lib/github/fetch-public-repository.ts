import "server-only";

import type {
  BranchInfo,
  MultiverseEdge,
  MultiverseGraph,
  MultiverseNode,
} from "@/types/multiverse";
import { HIGH_RISK_THRESHOLD } from "@/lib/graph/risk";

const COMMIT_LIMIT = 40;
const BRANCH_LIMIT = 12;
const VARIANT_HISTORY_LIMIT = 8;
const STALE_VARIANT_AGE_DAYS = 45;
const UNSTABLE_VARIANT_AGE_DAYS = 120;
const UNSTABLE_VARIANT_RISK = 35;

const repositoryQuery = `
  query RepositoryHistory(
    $owner: String!
    $name: String!
    $commitLimit: Int!
    $branchLimit: Int!
    $variantHistoryLimit: Int!
  ) {
    repository(owner: $owner, name: $name) {
      defaultBranchRef {
        name
        target {
          ... on Commit {
            history(first: $commitLimit) {
              nodes {
                oid
                message
                messageHeadline
                committedDate
                url
                author {
                  name
                  email
                }
                parents(first: 2) {
                  nodes {
                    oid
                  }
                }
              }
            }
          }
        }
      }
      refs(first: $branchLimit, refPrefix: "refs/heads/") {
        nodes {
          name
          target {
            ... on Commit {
              oid
              message
              messageHeadline
              committedDate
              url
              author {
                name
                email
              }
              parents(first: 2) {
                nodes {
                  oid
                }
              }
              history(first: $variantHistoryLimit) {
                nodes {
                  oid
                  message
                  messageHeadline
                  committedDate
                  url
                  author {
                    name
                    email
                  }
                  parents(first: 2) {
                    nodes {
                      oid
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

interface GitHubCommit {
  oid: string;
  message: string;
  messageHeadline: string;
  committedDate: string;
  url: string;
  author: { name: string; email: string } | null;
  parents: { nodes: Array<{ oid: string }> };
}

interface GitHubRepositoryResponse {
  data?: {
    repository: {
      defaultBranchRef: {
        name: string;
        target: { history: { nodes: GitHubCommit[] } } | null;
      } | null;
      refs: {
        nodes: GitHubBranchRef[];
      };
    } | null;
  };
  errors?: Array<{ message: string }>;
}

interface GitHubBranchRef {
  name: string;
  target: (GitHubCommit & { history: { nodes: GitHubCommit[] } }) | null;
}

export interface GitHubRepository {
  owner: string;
  name: string;
}

export function parseGitHubRepository(
  value: string | undefined,
): GitHubRepository | null {
  const [owner, name, ...extraSegments] = value?.trim().split("/") ?? [];

  if (!owner || !name || extraSegments.length > 0) {
    return null;
  }

  return { owner, name };
}

export function getConfiguredRepository(): GitHubRepository | null {
  return parseGitHubRepository(process.env.MULTIVERSE_REPOSITORY);
}

export async function fetchPublicRepositoryGraph(
  repository: GitHubRepository,
): Promise<MultiverseGraph> {
  const token = process.env.GITHUB_TOKEN;
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      query: repositoryQuery,
      variables: {
        owner: repository.owner,
        name: repository.name,
        commitLimit: COMMIT_LIMIT,
        branchLimit: BRANCH_LIMIT,
        variantHistoryLimit: VARIANT_HISTORY_LIMIT,
      },
    }),
  });

  const payload = (await response.json()) as GitHubRepositoryResponse;

  if (!response.ok || payload.errors?.length) {
    throw new Error(payload.errors?.[0]?.message ?? "GitHub request failed");
  }

  const githubRepository = payload.data?.repository;
  const defaultBranch = githubRepository?.defaultBranchRef;
  const history = defaultBranch?.target?.history.nodes;

  if (!githubRepository || !defaultBranch || !history?.length) {
    throw new Error("The repository has no accessible default branch history");
  }

  return toMultiverseGraph(history, githubRepository.refs.nodes, defaultBranch.name);
}

function toMultiverseGraph(
  history: GitHubCommit[],
  refs: GitHubBranchRef[],
  defaultBranchName: string,
): MultiverseGraph {
  const commitsByOid = new Map<string, GitHubCommit>();
  const branchNamesByOid = new Map<string, Set<string>>();
  const defaultTip = history[0];

  addCommits(commitsByOid, history);
  for (const ref of refs) {
    if (ref.target) {
      addCommits(commitsByOid, ref.target.history.nodes);
    }
  }

  const sacredTimelineOids = walkFirstParent(defaultTip.oid, commitsByOid);
  const includedOids = new Set(sacredTimelineOids);
  const tipOids = new Set<string>();

  tipOids.add(defaultTip.oid);
  const branches: BranchInfo[] = [
    {
      name: defaultBranchName,
      isDefault: true,
      tipOid: defaultTip.oid,
      aheadBy: 0,
      riskScore: 0,
      color: "#f5a623",
    },
  ];

  for (const ref of refs) {
    const tip = ref.target;
    if (!tip || ref.name === defaultBranchName) {
      continue;
    }

    const variantPath = walkVariantPath(tip.oid, commitsByOid, sacredTimelineOids);
    if (variantPath.oids.size === 0) {
      continue;
    }

    tipOids.add(tip.oid);
    for (const oid of variantPath.oids) {
      includedOids.add(oid);
      const branchNames = branchNamesByOid.get(oid) ?? new Set<string>();
      branchNames.add(ref.name);
      branchNamesByOid.set(oid, branchNames);
    }

    const riskScore = calculateBranchRisk(tip, variantPath, commitsByOid);
    branches.push({
      name: ref.name,
      isDefault: false,
      tipOid: tip.oid,
      aheadBy: variantPath.oids.size,
      riskScore,
      color: riskScore >= HIGH_RISK_THRESHOLD ? "#ef4444" : "#22d3ee",
    });
  }

  for (const sacredOid of sacredTimelineOids) {
    const sacredCommit = commitsByOid.get(sacredOid);
    if (!sacredCommit || sacredCommit.parents.nodes.length < 2) {
      continue;
    }

    for (const parent of sacredCommit.parents.nodes.slice(1)) {
      const convergencePath = walkVariantPath(
        parent.oid,
        commitsByOid,
        sacredTimelineOids,
      );
      for (const oid of convergencePath.oids) {
        includedOids.add(oid);
      }
    }
  }

  const riskScoreByBranch = new Map(
    branches.map((branch) => [branch.name, branch.riskScore]),
  );
  const nodes = Array.from(includedOids)
    .map((oid) => commitsByOid.get(oid))
    .filter((commit): commit is GitHubCommit => Boolean(commit))
    .map((commit) => {
      const branchNames = branchNamesByOid.get(commit.oid);
      const isDefaultBranch = sacredTimelineOids.has(commit.oid);
      const branchNamesList = branchNames
        ? Array.from(branchNames)
        : isDefaultBranch
          ? [defaultBranchName]
          : [];
      const riskScore = Math.max(
        0,
        ...branchNamesList.map((branch) => riskScoreByBranch.get(branch) ?? 0),
      );

      return {
        id: commit.oid,
        data: {
          message: commit.message,
          headline: commit.messageHeadline,
          author: commit.author ?? { name: "Unknown", email: "" },
          committedDate: commit.committedDate,
          parents: commit.parents.nodes.map((parent) => parent.oid),
          branches: branchNamesList,
          isDefaultBranch,
          isMerge: commit.parents.nodes.length > 1,
          isNexus:
            !isDefaultBranch &&
            commit.parents.nodes.some((parent) => sacredTimelineOids.has(parent.oid)),
          isTip: tipOids.has(commit.oid),
          url: commit.url,
          riskScore,
        },
        position: { x: 0, y: 0 },
        type: "commit",
      } satisfies MultiverseNode;
    });

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edges = nodes.flatMap((node) =>
    node.data.parents.flatMap((parentId) => {
      if (!nodeById.has(parentId)) {
        return [];
      }

      const parent = nodeById.get(parentId);
      const type: MultiverseEdge["type"] =
        node.data.isDefaultBranch && parent?.data.isDefaultBranch
          ? "sacred"
          : Math.max(node.data.riskScore, parent?.data.riskScore ?? 0) >=
              HIGH_RISK_THRESHOLD
            ? "incursion"
            : node.data.isMerge
              ? "convergence"
              : "variant";

      return [{ id: `${parentId}-${node.id}`, source: parentId, target: node.id, type }];
    }),
  );

  return keepConnectedTimeline(nodes, edges, branches);
}

function keepConnectedTimeline(
  nodes: MultiverseNode[],
  edges: MultiverseEdge[],
  branches: BranchInfo[],
): MultiverseGraph {
  const connectedNodeIds = new Set(
    nodes.filter((node) => node.data.isDefaultBranch).map((node) => node.id),
  );
  const adjacentNodeIds = new Map<string, string[]>();

  for (const edge of edges) {
    const sourceAdjacentNodeIds = adjacentNodeIds.get(edge.source) ?? [];
    sourceAdjacentNodeIds.push(edge.target);
    adjacentNodeIds.set(edge.source, sourceAdjacentNodeIds);

    const targetAdjacentNodeIds = adjacentNodeIds.get(edge.target) ?? [];
    targetAdjacentNodeIds.push(edge.source);
    adjacentNodeIds.set(edge.target, targetAdjacentNodeIds);
  }

  const pendingNodeIds = Array.from(connectedNodeIds);
  for (const nodeId of pendingNodeIds) {
    for (const adjacentNodeId of adjacentNodeIds.get(nodeId) ?? []) {
      if (!connectedNodeIds.has(adjacentNodeId)) {
        connectedNodeIds.add(adjacentNodeId);
        pendingNodeIds.push(adjacentNodeId);
      }
    }
  }

  return {
    nodes: nodes.filter((node) => connectedNodeIds.has(node.id)),
    edges: edges.filter(
      (edge) =>
        connectedNodeIds.has(edge.source) && connectedNodeIds.has(edge.target),
    ),
    branches: branches.filter(
      (branch) => branch.isDefault || connectedNodeIds.has(branch.tipOid),
    ),
  };
}

function addCommits(
  commitsByOid: Map<string, GitHubCommit>,
  commits: GitHubCommit[],
) {
  for (const commit of commits) {
    commitsByOid.set(commit.oid, commit);
  }
}

function walkFirstParent(
  startOid: string,
  commitsByOid: Map<string, GitHubCommit>,
): Set<string> {
  const oids = new Set<string>();
  let oid: string | undefined = startOid;

  while (oid && !oids.has(oid)) {
    oids.add(oid);
    oid = commitsByOid.get(oid)?.parents.nodes[0]?.oid;
  }

  return oids;
}

function walkVariantPath(
  startOid: string,
  commitsByOid: Map<string, GitHubCommit>,
  sacredTimelineOids: Set<string>,
): VariantPath {
  const oids = new Set<string>();
  let oid: string | undefined = startOid;

  while (oid && !oids.has(oid) && !sacredTimelineOids.has(oid)) {
    const commit = commitsByOid.get(oid);
    if (!commit) {
      break;
    }

    oids.add(oid);
    oid = commit.parents.nodes[0]?.oid;
  }

  return { oids, hasSacredBase: Boolean(oid && sacredTimelineOids.has(oid)) };
}

function calculateBranchRisk(
  tip: GitHubCommit,
  variantPath: VariantPath,
  commitsByOid: Map<string, GitHubCommit>,
): number {
  const ageInDays = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(tip.committedDate)) / 86_400_000),
  );
  const divergenceRisk = Math.min(
    24,
    Math.max(0, variantPath.oids.size - 3) * 3,
  );
  const stalenessRisk = Math.min(
    24,
    Math.floor(Math.max(0, ageInDays - STALE_VARIANT_AGE_DAYS) / 21) * 4,
  );
  const incompleteHistoryRisk = variantPath.hasSacredBase ? 0 : 6;
  const authorCount = new Set(
    Array.from(variantPath.oids, (oid) =>
      commitsByOid.get(oid)?.author?.email.trim(),
    ).filter((email): email is string => Boolean(email)),
  ).size;
  const authorRisk = Math.min(6, Math.max(0, authorCount - 2) * 3);
  const mergeRisk = tip.parents.nodes.length > 1 ? 2 : 0;
  const unstableVariantRisk =
    !variantPath.hasSacredBase &&
    variantPath.oids.size === VARIANT_HISTORY_LIMIT &&
    ageInDays >= UNSTABLE_VARIANT_AGE_DAYS
      ? UNSTABLE_VARIANT_RISK
      : 0;

  return Math.min(
    100,
    divergenceRisk +
      stalenessRisk +
      incompleteHistoryRisk +
      authorRisk +
      mergeRisk +
      unstableVariantRisk,
  );
}

interface VariantPath {
  oids: Set<string>;
  hasSacredBase: boolean;
}
