export type GitHubErrorKind = "not-found" | "empty" | "rate-limit" | "credentials" | "timeout" | "unavailable";

const messages: Record<GitHubErrorKind, string> = {
  "not-found": "This public repository could not be found. Check the owner and repository name.",
  empty: "This repository has no commits yet. Choose a repository with commit history.",
  "rate-limit": "GitHub's request limit has been reached. Wait a few minutes and try again.",
  credentials: "The server's GitHub credentials were rejected. The site administrator needs to update them.",
  timeout: "GitHub took too long to respond. Try loading the repository again.",
  unavailable: "GitHub is unavailable right now. Try loading the repository again.",
};

export class GitHubRequestError extends Error {
  readonly kind: GitHubErrorKind;
  constructor(kind: GitHubErrorKind) {
    super(messages[kind]);
    this.name = "GitHubRequestError";
    this.kind = kind;
  }
}

/** Server callers only. Never forward upstream response bodies or credentials to the UI. */
export async function githubRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: { Accept: "application/vnd.github+json", "User-Agent": "Multiverse-Git", ...init.headers },
      signal: init.signal ?? AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (!response.ok) {
      const kind: GitHubErrorKind = response.status === 404 ? "not-found"
        : response.status === 409 ? "empty"
        : response.status === 401 ? "credentials"
        : response.status === 429 || (response.status === 403 &&
          (response.headers.get("x-ratelimit-remaining") === "0" || response.headers.has("retry-after")))
          ? "rate-limit" : "unavailable";
      throw new GitHubRequestError(kind);
    }
    return await response.json() as T;
  } catch (error) {
    if (error instanceof GitHubRequestError) throw error;
    const isTimeout = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
    throw new GitHubRequestError(isTimeout ? "timeout" : "unavailable");
  }
}
