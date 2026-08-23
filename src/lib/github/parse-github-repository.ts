export interface GitHubRepository {
  name: string;
  owner: string;
}

const OWNER_PATTERN = /^[a-z\d](?:[a-z\d-]{0,38})$/i;
const REPOSITORY_PATTERN = /^[a-z\d._-]+$/i;

/**
 * Accept the repository references developers commonly paste without allowing
 * a path below a repository to masquerade as a repository itself.
 */
export function parseGitHubRepository(
  value: string | undefined,
): GitHubRepository | null {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return null;
  }

  const sshMatch = normalizedValue.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);

  if (sshMatch) {
    return createRepository(sshMatch[1], sshMatch[2]);
  }

  if (!normalizedValue.includes(":")) {
    const bareReference = normalizedValue
      .replace(/^github\.com\//i, "")
      .replace(/\/+$/, "");
    const segments = bareReference.split("/");

    if (segments.length === 2) {
      return createRepository(segments[0], stripGitSuffix(segments[1]));
    }

    return null;
  }

  let url: URL;

  try {
    url = new URL(normalizedValue);
  } catch {
    return null;
  }

  if (url.hostname.toLowerCase() !== "github.com") {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);

  if (segments.length !== 2) {
    return null;
  }

  return createRepository(segments[0], stripGitSuffix(segments[1]));
}

function createRepository(
  owner: string | undefined,
  name: string | undefined,
): GitHubRepository | null {
  if (!owner || !name || !OWNER_PATTERN.test(owner) || !REPOSITORY_PATTERN.test(name)) {
    return null;
  }

  return { name, owner };
}

function stripGitSuffix(name: string) {
  return name.replace(/\.git$/i, "");
}
