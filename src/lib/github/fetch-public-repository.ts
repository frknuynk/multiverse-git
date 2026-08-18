import "server-only";

import type {
  BranchInfo,
  MultiverseEdge,
  MultiverseGraph,
  MultiverseNode,
} from "@/types/multiverse";

const COMMIT_LIMIT = 40;
const BRANCH_LIMIT = 12;

const repositoryQuery = `
  query RepositoryHistory(
    $owner: String!
    $name: String!
    $commitLimit: Int!
    $branchLimit: Int!
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
        nodes: Array<{ name: string; target: GitHubCommit | null }>;
      };
    } | null;
  };
  errors?: Array<{ message: string }>;
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
  refs: Array<{ name: string; target: GitHubCommit | null }>,
  defaultBranchName: string,
): MultiverseGraph {
  const commitsByOid = new Map(history.map((commit) => [commit.oid, commit]));
  const branchNamesByOid = new Map<string, string[]>();
  const sacredTimelineOids = new Set(history.map((commit) => commit.oid));
  const tipOids = new Set<string>();

  tipOids.add(history[0].oid);

  for (const commit of history) {
    branchNamesByOid.set(commit.oid, [defaultBranchName]);
  }

  for (const ref of refs) {
    if (!ref.target) {
      continue;
    }

    commitsByOid.set(ref.target.oid, ref.target);
    tipOids.add(ref.target.oid);

    const branches = branchNamesByOid.get(ref.target.oid) ?? [];
    if (!branches.includes(ref.name)) {
      branches.push(ref.name);
    }
    branchNamesByOid.set(ref.target.oid, branches);
  }

  const branches = refs.flatMap((ref) => {
    if (!ref.target) {
      return [];
    }

    const isDefault = ref.name === defaultBranchName;
    const isOnSacredTimeline = sacredTimelineOids.has(ref.target.oid);
    const riskScore = calculateBranchRisk(
      ref.target,
      isDefault,
      isOnSacredTimeline,
    );

    return [
      {
        name: ref.name,
        isDefault,
        tipOid: ref.target.oid,
        aheadBy: isOnSacredTimeline ? 0 : 1,
        riskScore,
        color: isDefault ? "#f5a623" : riskScore >= 60 ? "#ef4444" : "#22d3ee",
      } satisfies BranchInfo,
    ];
  });

  if (!branches.some((branch) => branch.isDefault)) {
    branches.unshift({
      name: defaultBranchName,
      isDefault: true,
      tipOid: history[0].oid,
      aheadBy: 0,
      riskScore: 0,
      color: "#f5a623",
    });
  }

  const riskScoreByBranch = new Map(
    branches.map((branch) => [branch.name, branch.riskScore]),
  );

  const nodes = Array.from(commitsByOid.values()).map((commit) => {
    const branches = branchNamesByOid.get(commit.oid) ?? [];
    const isDefaultBranch = sacredTimelineOids.has(commit.oid);
    const riskScore = Math.max(
      0,
      ...branches.map((branch) => riskScoreByBranch.get(branch) ?? 0),
    );

    return {
      id: commit.oid,
      data: {
        message: commit.message,
        headline: commit.messageHeadline,
        author: commit.author ?? { name: "Unknown", email: "" },
        committedDate: commit.committedDate,
        parents: commit.parents.nodes.map((parent) => parent.oid),
        branches,
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
      const type: MultiverseEdge["type"] = node.data.isMerge
        ? "convergence"
        : node.data.isDefaultBranch && parent?.data.isDefaultBranch
          ? "sacred"
          : node.data.riskScore >= 60
            ? "incursion"
          : "variant";

      return [{ id: `${parentId}-${node.id}`, source: parentId, target: node.id, type }];
    }),
  );

  return { nodes, edges, branches };
}

function calculateBranchRisk(
  tip: GitHubCommit,
  isDefaultBranch: boolean,
  isOnSacredTimeline: boolean,
): number {
  if (isDefaultBranch || isOnSacredTimeline) {
    return 0;
  }

  const ageInDays = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(tip.committedDate)) / 86_400_000),
  );
  const stalenessRisk = Math.min(45, Math.floor(ageInDays / 7) * 4);
  const mergeRisk = tip.parents.nodes.length > 1 ? 10 : 0;

  return Math.min(100, 20 + stalenessRisk + mergeRisk);
}
