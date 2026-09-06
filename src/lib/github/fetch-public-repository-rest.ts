import { buildDag, type RawCommit } from "../graph/build-dag.ts";
import { githubRequest, GitHubRequestError } from "./github-request.ts";
import type { GitHubRepository } from "./parse-github-repository.ts";

interface RestCommit {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name: string; email: string; date: string } | null;
    committer: { date: string } | null;
  };
  parents: Array<{ sha: string }>;
}

/** A bounded public-only fallback: 100 recent commits + up to 6 × 30 Variant commits. */
export async function fetchPublicRepositoryRest(repository: GitHubRepository) {
  const base = `https://api.github.com/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}`;
  const signal = AbortSignal.timeout(25_000);
  const get = <T>(path: string) => githubRequest<T>(`${base}${path}`, { signal });
  const metadata = await get<{ default_branch: string; private: boolean }>("");
  if (metadata.private) throw new GitHubRequestError("not-found");
  const [history, refs] = await Promise.all([
    get<RestCommit[]>(`/commits?per_page=100&sha=${encodeURIComponent(metadata.default_branch)}`),
    get<Array<{ name: string; commit: { sha: string } }>>("/branches?per_page=12"),
  ]);
  if (!history.length) throw new GitHubRequestError("empty");
  const variants = refs.filter((ref) => ref.name !== metadata.default_branch).slice(0, 6);
  const histories = await Promise.all(variants.map((ref) =>
    get<RestCommit[]>(`/commits?per_page=30&sha=${encodeURIComponent(ref.commit.sha)}`),
  ));
  return buildDag(
    [...history, ...histories.flat()].map(normalizeCommit),
    { name: metadata.default_branch, tipOid: history[0].sha },
    variants.map((ref) => ({ name: ref.name, tipOid: ref.commit.sha })),
  );
}

function normalizeCommit(commit: RestCommit): RawCommit {
  return {
    oid: commit.sha, message: commit.commit.message,
    messageHeadline: commit.commit.message.split("\n")[0],
    committedDate: commit.commit.committer?.date ?? commit.commit.author?.date ?? "1970-01-01T00:00:00Z",
    url: commit.html_url, author: commit.commit.author,
    parents: { nodes: commit.parents.map((parent) => ({ oid: parent.sha })) },
  };
}
