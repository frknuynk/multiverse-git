"use client";

import { useMemo, useState } from "react";
import type { MultiverseGraph } from "@/types/multiverse";
import { exportGraphSvg } from "@/lib/graph/export-svg";

const buttonClass = "min-h-10 border border-white/20 px-3 text-xs text-[#d7d7e2] hover:border-cyan-300 focus-visible:outline-2 focus-visible:outline-cyan-300";
const actionButtonClass = `${buttonClass} w-full text-left sm:w-auto sm:text-center`;

export function GraphToolbar({ graph, repositoryLabel, onSelect }: {
  graph: MultiverseGraph; repositoryLabel: string; onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [exporting, setExporting] = useState(false);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const matches = useMemo(() => {
    const value = query.trim().toLowerCase();
    return value ? graph.nodes.filter((node) =>
      [node.id, node.data.headline, node.data.author.name, ...node.data.branches]
        .some((field) => field.toLowerCase().includes(value)),
    ).slice(0, 8) : [];
  }, [graph.nodes, query]);

  async function copyLink() {
    try {
      const url = new URL(window.location.href);
      // A failed repository load must never share a demo as real repository data.
      if (repositoryLabel === "Demo timeline") {
        url.searchParams.set("repo", "demo");
      }
      await navigator.clipboard.writeText(url.href);
      setStatus("Link copied. The current Variant or timeline window is included.");
    } catch {
      setStatus("Copy is unavailable. Copy the link from your browser's address bar.");
    }
  }

  async function exportImage(format: "svg" | "png") {
    setExporting(true);
    try {
      const svg = new Blob([exportGraphSvg(graph, repositoryLabel)], { type: "image/svg+xml;charset=utf-8" });
      let output = svg;
      if (format === "png") {
        const sourceUrl = URL.createObjectURL(svg);
        try {
          const image = new Image();
          image.src = sourceUrl;
          await image.decode();
          const scale = Math.min(1, 4096 / Math.max(image.width, image.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas unavailable");
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          output = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) =>
            blob ? resolve(blob) : reject(new Error("Export unavailable")), "image/png"));
        } finally { URL.revokeObjectURL(sourceUrl); }
      }
      const url = URL.createObjectURL(output);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${repositoryLabel.replace(/[^a-z0-9-]/gi, "-")}-multiverse.${format}`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus(`Full sample exported as ${format.toUpperCase()}.`);
    } catch { setStatus("Image export failed. Please try SVG or reload the timeline."); }
    finally { setExporting(false); }
  }

  return (
    <div className="space-y-2 sm:space-y-3">
      <div className="relative w-full min-w-0 pr-24 sm:hidden">
        <p className="min-h-10 min-w-0 truncate py-2.5 text-sm font-medium" title={repositoryLabel}>{repositoryLabel} <span className="font-normal text-[#a0a0b0]">· {graph.nodes.length} commits</span></p>
        <div className="absolute top-0 right-0 w-[5.5rem]">
          <button
            aria-expanded={isActionsOpen}
            className="relative z-10 min-h-10 w-full border border-white/20 bg-[#08090f] px-3 text-xs text-[#d7d7e2]"
            onClick={() => setIsActionsOpen((current) => !current)}
            type="button"
          >
            Actions
          </button>
          {isActionsOpen ? (
            <div className="absolute left-0 right-0 z-30 mt-1 grid gap-1 border border-white/20 bg-[#10111a] p-2 shadow-xl">
              <button type="button" className={actionButtonClass} onClick={() => { void copyLink(); setIsActionsOpen(false); }}>Copy view link</button>
              <button type="button" className={actionButtonClass} disabled={exporting} onClick={() => { void exportImage("svg"); setIsActionsOpen(false); }}>Export SVG</button>
              <button type="button" className={actionButtonClass} disabled={exporting} onClick={() => { void exportImage("png"); setIsActionsOpen(false); }}>Export PNG</button>
              <button type="button" className={actionButtonClass} onClick={() => { setIsHelpOpen(true); setIsActionsOpen(false); }}>Help</button>
            </div>
          ) : null}
        </div>
      </div>
      <div className="hidden items-center gap-2 sm:flex">
        <p className="min-w-0 flex-1 truncate text-sm font-medium" title={repositoryLabel}>{repositoryLabel} <span className="font-normal text-[#a0a0b0]">· {graph.nodes.length} commits</span></p>
        <div className="hidden flex-wrap items-center gap-2 sm:flex">
          <button type="button" className={buttonClass} onClick={copyLink}>Copy view link</button>
          <button type="button" className={buttonClass} disabled={exporting} onClick={() => exportImage("svg")}>Export SVG</button>
          <button type="button" className={buttonClass} disabled={exporting} onClick={() => exportImage("png")}>Export PNG</button>
        </div>
      </div>
      <div className="relative max-w-lg">
        <label htmlFor="commit-search" className="sr-only">Find a commit, author, or Variant</label>
        <input id="commit-search" value={query} onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Escape") setQuery(""); }}
          placeholder="Find a commit, author, or Variant…" autoComplete="off"
          className="min-h-11 w-full border border-white/20 bg-[#10111a] px-3 text-sm focus-visible:outline-2 focus-visible:outline-cyan-300 sm:min-h-10" />
        {query.trim() ? (
          <div className="absolute z-20 mt-1 w-full border border-white/20 bg-[#10111a] p-1 shadow-xl sm:max-h-72 sm:overflow-y-auto" aria-label="Commit search results">
            {matches.length ? matches.map((node) => (
              <button type="button" key={node.id} className="block min-h-12 w-full px-3 py-3 text-left text-xs hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-cyan-300"
                onClick={() => { onSelect(node.id); setQuery(""); }}>
                <span className="block truncate">{node.data.headline}</span>
                <span className="text-[#a0a0b0]">{node.id.slice(0, 8)} · {node.data.author.name}</span>
              </button>
            )) : <p className="p-3 text-xs text-[#a0a0b0]">No matching commits in this sample.</p>}
          </div>
        ) : null}
      </div>
      <p role="status" className="min-h-4 text-xs text-cyan-200">{status}</p>
      <div className="hidden text-xs text-[#a0a0b0] sm:block">
        <button
          aria-expanded={isHelpOpen}
          className="min-h-8 py-1 text-[#d7d7e2]"
          onClick={() => setIsHelpOpen((current) => !current)}
          type="button"
        >
          How to explore this timeline
        </button>
        {isHelpOpen ? (
          <p className="mt-2 max-w-3xl leading-5">Pan and zoom to explore. Select a commit for details, or choose a Variant to focus its history. Use the Timeline Scrubber to narrow the Sacred Timeline. Press Escape in the canvas to clear focus. Gold is the Sacred Timeline; cyan is healthy, violet is caution, and red indicates elevated Incursion Risk. Scores estimate divergence from sampled history; they do not prove a merge conflict. Exports include the full loaded sample.</p>
        ) : null}
      </div>
      {isHelpOpen ? (
        <div className="border border-white/15 bg-[#10111a] p-3 text-xs leading-5 text-[#aeb6c4] sm:hidden">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="font-semibold text-[#d7d7e2]">Timeline controls</p>
            <button className="min-h-8 px-2 text-cyan-300" onClick={() => setIsHelpOpen(false)} type="button">Close</button>
          </div>
          <p>Pan and zoom to explore. Select a commit for details, or choose a Variant to focus its history. Gold is the Sacred Timeline; cyan, violet, and red show increasing Incursion Risk.</p>
        </div>
      ) : null}
    </div>
  );
}
