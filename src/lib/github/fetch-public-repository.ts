import "server-only";

import type {
  BranchInfo,
  MultiverseEdge,
  MultiverseGraph,
  MultiverseNode,
} from "@/types/multiverse";
import { assessVariantRisk, HIGH_RISK_THRESHOLD } from "@/lib/graph/risk";
import { parseGitHubRepository } from "@/lib/github/parse-github-repository";
import { selectVariantRefs } from "@/lib/github/select-recent-variant-refs";
import type { GitHubRepository } from "@/lib/github/parse-github-repository";

export { parseGitHubRepository } from "@/lib/github/parse-github-repository";
export type { GitHubRepository } from "@/lib/github/parse-github-repository";

const COMMIT_LIMIT = 40;
const BRANCH_LIMIT = 12;
const OPEN_PULL_REQUEST_LIMIT = 10;
const VARIANT_TIP_LIMIT = 10;
const VARIANT_CONNECTION_PRIORITY_LIMIT = 4;
const VARIANT_WALK_COMMIT_CAP = 22;
const VARIANT_WALK_BATCH_DEPTH = 5;
const GLOBAL_COMMIT_LIMIT = 150;

const commitFields = `
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
`;

const repositoryQuery = `
  query RepositoryHistory(
    $owner: String!
    $name: String!
    $commitLimit: Int!
    $branchLimit: Int!
    $pullRequestLimit: Int!
  ) {
    repository(owner: $owner, name: $name) {
      defaultBranchRef {
        name
        target {
          ... on Commit {
            history(first: $commitLimit) {
              nodes {
                ${commitFields}
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
              ${commitFields}
            }
          }
        }
      }
      pullRequests(
        first: $pullRequestLimit
        states: OPEN
        orderBy: { field: UPDATED_AT, direction: DESC }
      ) {
        nodes {
          headRefName
          headRef {
            target {
              ... on Commit {
                ${commitFields}
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
  firstParent?: { nodes: GitHubCommit[] };
}

interface GitHubRepositoryData {
  repository: {
    defaultBranchRef: {
      name: string;
      target: { history: { nodes: GitHubCommit[] } } | null;
    } | null;
    refs: {
      nodes: GitHubBranchRef[];
    };
    pullRequests: {
      nodes: GitHubPullRequest[];
    };
  } | null;
}

interface GitHubBranchRef {
  name: string;
  target: GitHubCommit | null;
}

interface GitHubPullRequest {
  headRefName: string | null;
  headRef: { target: GitHubCommit | null } | null;
}

interface GitHubVariantWalkResponse {
  repository: Record<string, GitHubCommit | null> | null;
}

export function getConfiguredRepository(): GitHubRepository | null {
  return parseGitHubRepository(process.env.MULTIVERSE_REPOSITORY);
}

export async function fetchPublicRepositoryGraph(
  repository: GitHubRepository,
): Promise<MultiverseGraph> {
  const payload = await fetchGitHubGraphQL<GitHubRepositoryData>(
    repositoryQuery,
    {
      owner: repository.owner,
      name: repository.name,
      commitLimit: COMMIT_LIMIT,
      branchLimit: BRANCH_LIMIT,
      pullRequestLimit: OPEN_PULL_REQUEST_LIMIT,
    },
  );

  const githubRepository = payload.repository;
  const defaultBranch = githubRepository?.defaultBranchRef;
  const history = defaultBranch?.target?.history.nodes;

  if (!githubRepository || !defaultBranch || !history?.length) {
    throw new Error("The repository has no accessible default branch history");
  }

  return toMultiverseGraph(
    repository,
    history,
    githubRepository.refs.nodes,
    githubRepository.pullRequests.nodes,
    defaultBranch.name,
  );
}

async function fetchGitHubGraphQL<T>(
  query: string,
  variables: Record<string, string | number>,
): Promise<T> {
  const token = process.env.GITHUB_TOKEN;
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });

  const payload = (await response.json()) as {
    data?: T;
    errors?: Array<{ message: string }>;
  };

  if (!response.ok || payload.errors?.length) {
    throw new Error(payload.errors?.[0]?.message ?? "GitHub request failed");
  }

  if (!payload.data) {
    throw new Error("GitHub returned no data");
  }

  return payload.data;
}

async function toMultiverseGraph(
  repository: GitHubRepository,
  history: GitHubCommit[],
  refs: GitHubBranchRef[],
  pullRequests: GitHubPullRequest[],
  defaultBranchName: string,
): Promise<MultiverseGraph> {
  const commitsByOid = new Map<string, GitHubCommit>();
  const branchNamesByOid = new Map<string, Set<string>>();
  const defaultTip = history[0];

  addCommits(commitsByOid, history);
  const sacredTimelineOids = walkFirstParent(defaultTip.oid, commitsByOid);
  const includedOids = new Set(sacredTimelineOids);
  const tipOids = new Set<string>();
  const sampledVariants = await sampleVariantHistories(
    repository,
    selectVariantRefs(
      getPullRequestVariantRefs(pullRequests),
      refs,
      defaultBranchName,
      VARIANT_TIP_LIMIT,
    ),
    commitsByOid,
    sacredTimelineOids,
  );

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

  for (const sampledVariant of sampledVariants) {
    const { name, tip, variantPath } = sampledVariant;

    tipOids.add(tip.oid);
    for (const oid of variantPath.oids) {
      includedOids.add(oid);
      const branchNames = branchNamesByOid.get(oid) ?? new Set<string>();
      branchNames.add(name);
      branchNamesByOid.set(oid, branchNames);
    }

    const riskScore = calculateBranchRisk(tip, variantPath, commitsByOid);
    branches.push({
      name,
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

function getPullRequestVariantRefs(
  pullRequests: GitHubPullRequest[],
): GitHubBranchRef[] {
  return pullRequests.flatMap((pullRequest) => {
    if (!pullRequest.headRefName || !pullRequest.headRef?.target) {
      return [];
    }

    return [
      {
        name: pullRequest.headRefName,
        target: pullRequest.headRef.target,
      },
    ];
  });
}

async function sampleVariantHistories(
  repository: GitHubRepository,
  refs: GitHubBranchRef[],
  commitsByOid: Map<string, GitHubCommit>,
  sacredTimelineOids: Set<string>,
): Promise<SampledVariant[]> {
  const states: VariantWalkState[] = [];

  for (const ref of refs) {
    const tip = ref.target;
    if (!tip || sacredTimelineOids.has(tip.oid)) {
      continue;
    }

    if (!commitsByOid.has(tip.oid)) {
      if (commitsByOid.size >= GLOBAL_COMMIT_LIMIT) {
        break;
      }

      commitsByOid.set(tip.oid, tip);
    }

    const firstParentOid = tip.parents.nodes[0]?.oid;
    const variantPath: VariantPath = {
      hasSacredBase: Boolean(firstParentOid && sacredTimelineOids.has(firstParentOid)),
      oids: new Set([tip.oid]),
    };

    states.push({
      name: ref.name,
      nextOid: variantPath.hasSacredBase ? undefined : firstParentOid,
      tip,
      variantPath,
    });
  }

  let nextStateIndex = 0;
  const priorityStates = states.slice(0, VARIANT_CONNECTION_PRIORITY_LIMIT);

  while (commitsByOid.size < GLOBAL_COMMIT_LIMIT) {
    const activeStates = states.filter(
      (state) =>
        Boolean(state.nextOid) &&
        !state.variantPath.hasSacredBase &&
        state.variantPath.oids.size < VARIANT_WALK_COMMIT_CAP,
    );
    const activePriorityStates = priorityStates.filter((state) =>
      activeStates.includes(state),
    );
    const statesToPrioritize = activePriorityStates.length > 0
      ? activePriorityStates
      : activeStates;

    if (statesToPrioritize.length === 0) {
      break;
    }

    const remainingCommitBudget = GLOBAL_COMMIT_LIMIT - commitsByOid.size;
    const remainingVariantBudget = Math.min(
      ...statesToPrioritize.map(
        (state) => VARIANT_WALK_COMMIT_CAP - state.variantPath.oids.size,
      ),
    );
    const walkDepth = Math.min(
      VARIANT_WALK_BATCH_DEPTH,
      remainingCommitBudget,
      remainingVariantBudget,
    );
    const batchSize = Math.min(
      statesToPrioritize.length,
      Math.floor(remainingCommitBudget / walkDepth),
    );

    if (batchSize === 0) {
      break;
    }

    const statesToWalk = takeWalkBatch(
      statesToPrioritize,
      batchSize,
      nextStateIndex,
    );
    nextStateIndex =
      (nextStateIndex + statesToWalk.length) % statesToPrioritize.length;
    const walkedCommits = await fetchVariantWalkBatch(
      repository,
      statesToWalk.map((state) => state.nextOid as string),
      walkDepth,
    );

    for (let index = 0; index < statesToWalk.length; index += 1) {
      const state = statesToWalk[index];
      const walkedCommit = walkedCommits[index];

      if (!walkedCommit) {
        state.nextOid = undefined;
        continue;
      }

      addWalkedCommits(
        state,
        walkedCommit,
        walkDepth,
        commitsByOid,
        sacredTimelineOids,
      );
    }
  }

  return states;
}

function takeWalkBatch(
  states: VariantWalkState[],
  batchSize: number,
  startIndex: number,
): VariantWalkState[] {
  return Array.from(
    { length: batchSize },
    (_, index) => states[(startIndex + index) % states.length],
  );
}

function addWalkedCommits(
  state: VariantWalkState,
  initialCommit: GitHubCommit,
  walkDepth: number,
  commitsByOid: Map<string, GitHubCommit>,
  sacredTimelineOids: Set<string>,
) {
  let commit: GitHubCommit | undefined = initialCommit;

  for (let depth = 0; depth < walkDepth && commit; depth += 1) {
    if (sacredTimelineOids.has(commit.oid)) {
      state.variantPath.hasSacredBase = true;
      state.nextOid = undefined;
      return;
    }

    if (state.variantPath.oids.has(commit.oid)) {
      state.nextOid = undefined;
      return;
    }

    if (!commitsByOid.has(commit.oid)) {
      if (commitsByOid.size >= GLOBAL_COMMIT_LIMIT) {
        return;
      }

      commitsByOid.set(commit.oid, commit);
    }

    state.variantPath.oids.add(commit.oid);
    const firstParentOid = commit.parents.nodes[0]?.oid;

    if (firstParentOid && sacredTimelineOids.has(firstParentOid)) {
      state.variantPath.hasSacredBase = true;
      state.nextOid = undefined;
      return;
    }

    if (
      !firstParentOid ||
      state.variantPath.oids.size >= VARIANT_WALK_COMMIT_CAP
    ) {
      state.nextOid = undefined;
      return;
    }

    const firstParent: GitHubCommit | undefined = commit.firstParent?.nodes[0];
    if (!firstParent) {
      state.nextOid = firstParentOid;
      return;
    }

    commit = firstParent;
  }
}

async function fetchVariantWalkBatch(
  repository: GitHubRepository,
  startingOids: string[],
  walkDepth: number,
): Promise<Array<GitHubCommit | null>> {
  const query = createVariantWalkQuery(startingOids.length, walkDepth);
  const variables: Record<string, string | number> = {
    name: repository.name,
    owner: repository.owner,
  };

  for (const [index, oid] of startingOids.entries()) {
    variables[`variant${index}`] = oid;
  }

  const payload = await fetchGitHubGraphQL<GitHubVariantWalkResponse>(
    query,
    variables,
  );

  return startingOids.map(
    (_, index) => payload.repository?.[`variant${index}`] ?? null,
  );
}

function createVariantWalkQuery(variantCount: number, walkDepth: number) {
  const variantVariables = Array.from(
    { length: variantCount },
    (_, index) => `$variant${index}: String!`,
  ).join(", ");
  const variantObjects = Array.from(
    { length: variantCount },
    (_, index) => `
      variant${index}: object(expression: $variant${index}) {
        ... on Commit {
          ${createFirstParentSelection(walkDepth)}
        }
      }
    `,
  ).join("\n");

  return `
    query VariantWalk($owner: String!, $name: String!, ${variantVariables}) {
      repository(owner: $owner, name: $name) {
        ${variantObjects}
      }
    }
  `;
}

function createFirstParentSelection(depth: number): string {
  const nextParent = depth > 1
    ? `
      firstParent: parents(first: 1) {
        nodes {
          ${createFirstParentSelection(depth - 1)}
        }
      }
    `
    : "";

  return `${commitFields}${nextParent}`;
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
  const authorCount = new Set(
    Array.from(variantPath.oids, (oid) =>
      commitsByOid.get(oid)?.author?.email.trim(),
    ).filter((email): email is string => Boolean(email)),
  ).size;

  return assessVariantRisk({
    authorCount,
    commitsShown: variantPath.oids.size,
    hasSacredBase: variantPath.hasSacredBase,
    tipCommittedDate: tip.committedDate,
    tipIsMerge: tip.parents.nodes.length > 1,
  }).score;
}

interface VariantPath {
  oids: Set<string>;
  hasSacredBase: boolean;
}

interface SampledVariant {
  name: string;
  tip: GitHubCommit;
  variantPath: VariantPath;
}

interface VariantWalkState extends SampledVariant {
  nextOid?: string;
}
