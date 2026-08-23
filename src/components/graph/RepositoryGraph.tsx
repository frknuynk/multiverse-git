import { MultiverseCanvas } from "@/components/graph/MultiverseCanvas";
import type { SharedGraphView } from "@/lib/graph/shared-graph-view";
import {
  fetchPublicRepositoryGraph,
} from "@/lib/github/fetch-public-repository";
import type { GitHubRepository } from "@/lib/github/fetch-public-repository";
import type { MultiverseGraph } from "@/types/multiverse";

interface RepositoryGraphProps {
  initialView?: SharedGraphView;
  repository: GitHubRepository | null;
  errorMessage?: string;
}

export async function RepositoryGraph({
  repository,
  errorMessage,
  initialView,
}: RepositoryGraphProps) {
  if (errorMessage) {
    return <RepositoryFallback initialView={initialView} message={errorMessage} />;
  }

  if (!repository) {
    return <MultiverseCanvas initialView={initialView} />;
  }

  const graph = await loadRepositoryGraph(repository);

  if (graph) {
    return (
      <MultiverseCanvas
        initialGraph={graph}
        initialView={initialView}
        isSampled
        key={`${repository.owner}/${repository.name}`}
      />
    );
  }

  return (
    <RepositoryFallback
      initialView={initialView}
      message="GitHub data could not be loaded. Showing the demo timeline instead."
    />
  );
}

function RepositoryFallback({
  initialView,
  message,
}: {
  initialView?: SharedGraphView;
  message: string;
}) {
  return (
    <div className="space-y-4">
      <p
        className="border border-red-400/40 bg-[#0c0c14] px-4 py-3 text-sm text-[#f0f0f5]"
        role="alert"
      >
        {message}
      </p>
      <MultiverseCanvas initialView={initialView} />
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

    return graph;
  } catch {
    return null;
  }
}
