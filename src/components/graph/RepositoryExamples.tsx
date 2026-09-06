"use client";

import { useState } from "react";
import Link from "next/link";

interface RepositoryExamplesProps {
  repositories: string[];
}

export function RepositoryExamples({ repositories }: RepositoryExamplesProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative mt-2 sm:hidden">
      <button
        aria-expanded={isOpen}
        className="min-h-9 border border-[#f5a623]/45 px-3 text-xs font-medium text-[#f5c567]"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        Examples
      </button>
      {isOpen ? (
        <div className="absolute left-0 right-0 z-30 mt-2 border border-white/15 bg-[#10111a] p-2 shadow-2xl">
          <div className="grid grid-cols-2 gap-2">
            <Link
              className="min-h-10 border border-[#f5a623]/45 bg-[#0c0c14] px-2 py-2 text-xs text-[#f5c567]"
              href="/?repo=demo"
              onClick={() => setIsOpen(false)}
            >
              Demo
            </Link>
            {repositories.map((repository) => (
              <Link
                className="min-h-10 border border-white/15 bg-[#0c0c14] px-2 py-2 text-xs text-[#d7d7e2]"
                href={`/?repo=${encodeURIComponent(repository)}`}
                key={repository}
                onClick={() => setIsOpen(false)}
              >
                {repository}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
