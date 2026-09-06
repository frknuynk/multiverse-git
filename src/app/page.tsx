import { Suspense } from "react";
import Link from "next/link";

import { RepositoryExamples } from "@/components/graph/RepositoryExamples";
import { RepositoryGraph } from "@/components/graph/RepositoryGraph";
import {
  getConfiguredRepository,
  parseGitHubRepository,
} from "@/lib/github/fetch-public-repository";
import { parseSharedGraphView } from "@/lib/graph/shared-graph-view";

interface HomeProps {
  searchParams: Promise<{
    repo?: string | string[];
    timelineEnd?: string | string[];
    timelineStart?: string | string[];
    variant?: string | string[];
  }>;
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

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: HomeProps) {
  const resolvedSearchParams = await searchParams;
  const { repo } = resolvedSearchParams;
  const hasRepositoryQuery = repo !== undefined;
  const requestedRepository = typeof repo === "string" ? repo : undefined;
  const configuredRepository = getConfiguredRepository();
  const isDemo = requestedRepository === "demo";
  const repository = isDemo ? null : hasRepositoryQuery
    ? parseGitHubRepository(requestedRepository)
    : configuredRepository;
  const inputValue = requestedRepository ?? formatRepository(configuredRepository);
  const isFirstRun = !hasRepositoryQuery && !configuredRepository;
  const errorMessage = hasRepositoryQuery && !repository && !isDemo
    ? "Enter a public repository as owner/repo or a github.com URL."
    : undefined;
  const initialView = parseSharedGraphView(resolvedSearchParams);

  return (
    <main
      className="min-h-screen bg-[#05050a] text-[#f0f0f5]"
      style={{
        backgroundImage:
          "radial-gradient(ellipse 54% 34% at 50% -8%, rgba(245,166,35,0.08) 0%, rgba(245,166,35,0) 68%), radial-gradient(ellipse 36% 28% at 9% 0%, rgba(34,211,238,0.055) 0%, rgba(34,211,238,0) 72%)",
      }}
    >
      <header className="border-b border-[#34333e] bg-[#08090f]/95 shadow-[inset_0_-1px_0_rgba(245,166,35,0.12)]">
        <div className="mx-auto max-w-[1600px] px-3 py-2 sm:px-6 sm:py-3 lg:px-8">
          <div className="grid gap-2 sm:flex sm:min-h-9 sm:flex-wrap sm:items-center sm:gap-3">
            <div className="flex min-w-0 items-baseline gap-2">
              <h1 className="shrink-0 text-base font-semibold tracking-tight sm:text-lg">Multiverse Git</h1>
              <span className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-[#a9894c] sm:inline">
                Timeline Monitor
              </span>
            </div>
            <form
              action="/"
              className="relative w-full min-w-0 sm:flex-1 sm:max-w-sm"
            >
              <label className="sr-only" htmlFor="repository">
                Public GitHub repository
              </label>
              <input
                className="h-10 w-full min-w-0 border border-white/15 bg-[#0c0c14] py-0 pr-20 pl-3 text-sm text-[#f0f0f5] placeholder:text-[#a0a0b0] outline-none transition-colors focus:border-cyan-400/80 sm:h-9"
                defaultValue={isDemo ? "" : inputValue}
                id="repository"
                name="repo"
                placeholder="owner/repo"
                required
                title="Enter owner/repo or a public GitHub repository URL"
              />
              <button
                className="absolute top-0 right-0 z-10 h-10 w-[4.75rem] border border-[#f5a623]/50 bg-[#08090f] px-3 text-sm font-medium text-[#fff4dd] transition-colors hover:border-[#f5a623] hover:bg-[#14100a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5a623] sm:h-9"
                type="submit"
              >
                Load
              </button>
            </form>
          </div>
          <RepositoryExamples repositories={suggestedRepositories} />
          <nav aria-label="Suggested public repositories" className="mt-3 hidden flex-wrap items-center gap-2 sm:flex">
            <span className="text-xs text-[#a0a0b0]">Explore a timeline:</span>
            <Link className="px-2 py-1 text-xs text-[#f5c567] underline" href="/?repo=demo">Demo</Link>
            {suggestedRepositories.map((suggestedRepository) => (
              <Link
                className="border border-white/15 bg-[#0c0c14] px-2 py-1 text-xs text-[#d7d7e2] transition-colors hover:border-cyan-400/70 hover:text-[#f0f0f5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
                href={getRepositoryHref(suggestedRepository)}
                key={suggestedRepository}
              >
                {suggestedRepository}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <section className="mx-auto max-w-[1600px] px-3 py-2 sm:px-6 sm:py-6 lg:px-8">
        {isFirstRun ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-white/10 bg-[#0c0c14] px-4 py-3 text-sm">
            <p className="text-[#d7d7e2]">
              Choose a public repository to trace its Sacred Timeline and active Variants.
            </p>
            <Link
              className="border border-[#f5a623]/60 px-3 py-1.5 text-xs font-medium text-[#f5c567] transition-colors hover:border-[#f5a623] hover:text-[#fff8eb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5a623]"
              href={getRepositoryHref(suggestedRepositories[0])}
            >
              Try facebook/react
            </Link>
          </div>
        ) : null}
        <Suspense
          fallback={
            <p role="status" className="flex h-[600px] items-center justify-center border border-white/10 bg-[#0c0c14] text-sm text-[#a0a0b0]">
              Scanning the timeline…
            </p>
          }
        >
          <RepositoryGraph
            errorMessage={errorMessage}
            initialView={initialView}
            repository={repository}
          />
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
