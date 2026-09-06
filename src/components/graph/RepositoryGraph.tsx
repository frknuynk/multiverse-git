import { cache } from "react";
import Link from "next/link";
import { MultiverseCanvas } from "@/components/graph/MultiverseCanvas";
import { fetchPublicRepositoryGraph, type GitHubRepository } from "@/lib/github/fetch-public-repository";
import { GitHubRequestError } from "@/lib/github/github-request";
import { fakeMultiverseGraph } from "@/lib/graph/fake-multiverse-graph";
import { layoutMultiverseGraph } from "@/lib/graph/layout";
import type { SharedGraphView } from "@/lib/graph/shared-graph-view";
import type { MultiverseGraph } from "@/types/multiverse";

interface RepositoryGraphProps {
  initialView?: SharedGraphView;
  repository: GitHubRepository | null;
  errorMessage?: string;
}

const getDemoGraph = cache(() => layoutMultiverseGraph(fakeMultiverseGraph));

export async function RepositoryGraph({ repository, errorMessage, initialView }: RepositoryGraphProps) {
  let message = errorMessage;
  let graph: MultiverseGraph | null = null;

  if (repository && !message) {
    try {
      graph = await layoutMultiverseGraph(await fetchPublicRepositoryGraph(repository));
    } catch (error) {
      message = error instanceof GitHubRequestError ? error.message
        : "The timeline could not be prepared. Try loading the repository again.";
    }
  }

  if (repository && graph) {
    return <MultiverseCanvas initialGraph={graph} initialView={initialView} isSampled
      repositoryLabel={`${repository.owner}/${repository.name}`}
      key={`${repository.owner}/${repository.name}`} />;
  }

  return (
    <div className="space-y-4">
      {message ? (
        <div className="border border-red-400/40 bg-[#0c0c14] px-4 py-3 text-sm" role="alert">
          <p>{message} Showing the demo timeline below.</p>
          {repository ? <Link className="mt-2 inline-block text-cyan-300 underline" href={`/?repo=${encodeURIComponent(`${repository.owner}/${repository.name}`)}`}>Retry repository</Link> : null}
        </div>
      ) : null}
      <MultiverseCanvas initialGraph={await getDemoGraph()} initialView={message ? undefined : initialView} repositoryLabel="Demo timeline" />
    </div>
  );
}
