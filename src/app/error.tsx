"use client";

import Link from "next/link";

export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <main className="mx-auto max-w-xl space-y-4 px-6 py-20">
      <h1 className="text-xl font-semibold">The timeline could not be opened</h1>
      <p className="text-sm text-[#a0a0b0]">An unexpected error interrupted the graph. Try again or explore the demo timeline.</p>
      <button className="min-h-10 border border-cyan-400 px-4 text-sm" onClick={() => retry()}>Try again</button>
      <Link className="ml-4 text-sm text-cyan-300 underline" href="/?repo=demo">Open demo</Link>
    </main>
  );
}
