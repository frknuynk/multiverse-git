"use client";

import { create } from "zustand";

import type { MultiverseGraph } from "@/types/multiverse";

const createEmptyGraph = (): MultiverseGraph => ({
  nodes: [],
  edges: [],
  branches: [],
});

interface MultiverseGraphState {
  graph: MultiverseGraph;
  setGraph: (graph: MultiverseGraph) => void;
  resetGraph: () => void;
}

export const useMultiverseGraphStore = create<MultiverseGraphState>((set) => ({
  graph: createEmptyGraph(),
  setGraph: (graph) => set({ graph }),
  resetGraph: () => set({ graph: createEmptyGraph() }),
}));
