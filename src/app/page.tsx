import { Suspense } from "react";

import { RepositoryGraph } from "@/components/graph/RepositoryGraph";
import {
  getConfiguredRepository,
  parseGitHubRepository,
} from "@/lib/github/fetch-public-repository";

interface HomeProps {
  searchParams: Promise<{ repo?: string | string[] }>;
}

const suggestedRepositories = [
  "facebook/react",
  "vercel/next.js",
  "microsoft/vscode",
  "nodejs/node",
  "storybookjs/storybook",
  "microsoft/TypeScript",
  "kubernetes/kubernetes",
  "rust-lang/rust",
  "flutter/flutter",
  "vitejs/vite",
];

export default async function Home({ searchParams }: HomeProps) {
  const { repo } = await searchParams;
  const hasRepositoryQuery = repo !== undefined;
  const requestedRepository = typeof repo === "string" ? repo : undefined;
  const configuredRepository = getConfiguredRepository();
  const repository = hasRepositoryQuery
    ? parseGitHubRepository(requestedRepository)
    : configuredRepository;
  const inputValue = requestedRepository ?? formatRepository(configuredRepository);
  const isFirstRun = !hasRepositoryQuery && !configuredRepository;
  const errorMessage = hasRepositoryQuery && !repository
    ? "Enter a public repository in owner/repo format. Showing the demo timeline instead."
    : undefined;

  return (
    <main
      className="min-h-screen bg-[#05050a] text-[#f0f0f5]"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at 50% -12%, rgba(35, 40, 54, 0.24) 0%, rgba(5, 5, 10, 0) 46%)",
      }}
    >
      <header className="border-b border-[#292b37] bg-[#08090f] shadow-[inset_0_-1px_0_rgba(245,166,35,0.08)]">
        <div className="mx-auto max-w-[1600px] px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-h-9 flex-wrap items-center gap-3">
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
          <nav aria-label="Suggested public repositories" className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-[#a0a0b0]">Explore a timeline:</span>
            {suggestedRepositories.map((suggestedRepository) => (
              <a
                className="border border-white/15 bg-[#0c0c14] px-2 py-1 text-xs text-[#d7d7e2] transition-colors hover:border-cyan-400/70 hover:text-[#f0f0f5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
                href={getRepositoryHref(suggestedRepository)}
                key={suggestedRepository}
              >
                {suggestedRepository}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <section className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        {isFirstRun ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-white/10 bg-[#0c0c14] px-4 py-3 text-sm">
            <p className="text-[#d7d7e2]">
              Choose a public repository to trace its Sacred Timeline and active Variants.
            </p>
            <a
              className="border border-[#f5a623]/60 px-3 py-1.5 text-xs font-medium text-[#f5c567] transition-colors hover:border-[#f5a623] hover:text-[#fff8eb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5a623]"
              href={getRepositoryHref(suggestedRepositories[0])}
            >
              Try facebook/react
            </a>
          </div>
        ) : null}
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

function getRepositoryHref(repository: string): string {
  return `/?repo=${encodeURIComponent(repository)}`;
}
