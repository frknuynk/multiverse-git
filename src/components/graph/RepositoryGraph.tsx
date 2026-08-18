import { MultiverseCanvas } from "@/components/graph/MultiverseCanvas";
import {
  fetchPublicRepositoryGraph,
} from "@/lib/github/fetch-public-repository";
import type { GitHubRepository } from "@/lib/github/fetch-public-repository";
import type { MultiverseGraph } from "@/types/multiverse";

interface RepositoryGraphProps {
  repository: GitHubRepository | null;
  errorMessage?: string;
}

export async function RepositoryGraph({
  repository,
  errorMessage,
}: RepositoryGraphProps) {
  if (errorMessage) {
    return <RepositoryFallback message={errorMessage} />;
  }

  if (!repository) {
    return <MultiverseCanvas />;
  }

  const graph = await loadRepositoryGraph(repository);

  if (graph) {
    return (
      <MultiverseCanvas
        initialGraph={graph}
        isSampled
        key={`${repository.owner}/${repository.name}`}
      />
    );
  }

  return (
    <RepositoryFallback message="GitHub data could not be loaded. Showing the demo timeline instead." />
  );
}

function RepositoryFallback({ message }: { message: string }) {
  return (
    <div className="space-y-4">
      <p
        className="border border-red-400/40 bg-[#0c0c14] px-4 py-3 text-sm text-[#f0f0f5]"
        role="alert"
      >
        {message}
      </p>
      <MultiverseCanvas />
    </div>
  );
}

async function loadRepositoryGraph(
  repository: GitHubRepository,
): Promise<MultiverseGraph | null> {
  try {
    const graph = await fetchPublicRepositoryGraph(repository);

    if (graph.nodes.length === 0) {
      throw new Error("GitHub returned no commits for this repository");
    }

    console.info(
      `[Multiverse Git] Loaded real GitHub data from ${repository.owner}/${repository.name}.`,
    );

    return graph;
  } catch {
    console.warn(
      `[Multiverse Git] Could not load ${repository.owner}/${repository.name}; using fake graph data.`,
    );

    return null;
  }
}
