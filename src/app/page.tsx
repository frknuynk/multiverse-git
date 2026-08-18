import { Suspense } from "react";

import { RepositoryGraph } from "@/components/graph/RepositoryGraph";
import {
  getConfiguredRepository,
  parseGitHubRepository,
} from "@/lib/github/fetch-public-repository";

interface HomeProps {
  searchParams: Promise<{ repo?: string | string[] }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const { repo } = await searchParams;
  const hasRepositoryQuery = repo !== undefined;
  const requestedRepository = typeof repo === "string" ? repo : undefined;
  const configuredRepository = getConfiguredRepository();
  const repository = hasRepositoryQuery
    ? parseGitHubRepository(requestedRepository)
    : configuredRepository;
  const inputValue = requestedRepository ?? formatRepository(configuredRepository);
  const errorMessage = hasRepositoryQuery && !repository
    ? "Enter a public repository in owner/repo format. Showing the demo timeline instead."
    : undefined;

  return (
    <main className="min-h-screen bg-[#05050a] text-[#f0f0f5]">
      <header className="border-b border-white/10">
        <div className="mx-auto flex min-h-16 max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <h1 className="text-lg font-semibold tracking-tight">Multiverse Git</h1>
          <form action="/" className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-sm">
            <label className="sr-only" htmlFor="repository">
              Public GitHub repository
            </label>
            <input
              className="h-9 min-w-0 flex-1 border border-white/15 bg-[#0c0c14] px-3 text-sm text-[#f0f0f5] placeholder:text-[#a0a0b0]"
              defaultValue={inputValue}
              id="repository"
              name="repo"
              placeholder="owner/repo"
              required
            />
            <button
              className="h-9 border border-white/20 px-3 text-sm font-medium"
              type="submit"
            >
              Load
            </button>
          </form>
        </div>
      </header>
      <section className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <Suspense
          fallback={
            <p className="flex h-[600px] items-center justify-center border border-white/10 bg-[#0c0c14] text-sm text-[#a0a0b0]">
              Scanning the timeline…
            </p>
          }
        >
          <RepositoryGraph errorMessage={errorMessage} repository={repository} />
        </Suspense>
      </section>
    </main>
  );
}

function formatRepository(
  repository: ReturnType<typeof getConfiguredRepository>,
): string {
  return repository ? `${repository.owner}/${repository.name}` : "";
}
