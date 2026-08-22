import type { MultiverseGraph, MultiverseNode } from "@/types/multiverse";

function createCommit(
  id: string,
  options: Partial<MultiverseNode["data"]> = {},
): MultiverseNode {
  return {
    id,
    data: {
      author: { email: "tva@example.com", name: "TVA" },
      branches: [],
      committedDate: "2026-08-19T00:00:00.000Z",
      headline: id,
      isDefaultBranch: false,
      isMerge: false,
      isNexus: false,
      isTip: false,
      message: id,
      parents: [],
      riskScore: 0,
      url: `https://example.test/${id}`,
      ...options,
    },
    position: { x: 0, y: 0 },
    type: "commit",
  };
}

export const sacredTimelineGraph: MultiverseGraph = {
  branches: [
    {
      aheadBy: 0,
      color: "#f5a623",
      isDefault: true,
      name: "main",
      riskScore: 0,
      tipOid: "sacred-tip",
    },
  ],
  edges: [],
  nodes: [
    createCommit("sacred-tip", {
      branches: ["main"],
      isDefaultBranch: true,
      isTip: true,
    }),
  ],
};

export const namedVariantGraph: MultiverseGraph = {
  branches: [
    {
      aheadBy: 0,
      color: "#f5a623",
      isDefault: true,
      name: "main",
      riskScore: 0,
      tipOid: "sacred-tip",
    },
    {
      aheadBy: 2,
      color: "#a78bfa",
      isDefault: false,
      name: "feature/timeline-copy",
      riskScore: 42,
      tipOid: "variant-tip",
    },
    {
      aheadBy: 1,
      color: "#22d3ee",
      isDefault: false,
      name: "feature/other",
      riskScore: 12,
      tipOid: "other-tip",
    },
  ],
  edges: [
    {
      id: "sacred-base-variant-start",
      source: "sacred-base",
      target: "variant-start",
      type: "variant",
    },
    {
      id: "variant-start-variant-tip",
      source: "variant-start",
      target: "variant-tip",
      type: "variant",
    },
    {
      id: "sacred-base-sacred-tip",
      source: "sacred-base",
      target: "sacred-tip",
      type: "sacred",
    },
    {
      id: "sacred-base-other-tip",
      source: "sacred-base",
      target: "other-tip",
      type: "variant",
    },
  ],
  nodes: [
    createCommit("sacred-base", {
      branches: ["main"],
      isDefaultBranch: true,
    }),
    createCommit("variant-start", { branches: ["feature/timeline-copy"] }),
    createCommit("variant-tip", {
      branches: ["feature/timeline-copy"],
      isTip: true,
    }),
    createCommit("sacred-tip", {
      branches: ["main"],
      isDefaultBranch: true,
      isTip: true,
    }),
    createCommit("other-tip", {
      branches: ["feature/other"],
      isTip: true,
    }),
  ],
};

export const unnamedMergeSideGraph: MultiverseGraph = {
  branches: [
    {
      aheadBy: 0,
      color: "#f5a623",
      isDefault: true,
      name: "main",
      riskScore: 0,
      tipOid: "sacred-tip",
    },
  ],
  edges: [
    {
      id: "sacred-base-unnamed-start",
      source: "sacred-base",
      target: "unnamed-start",
      type: "variant",
    },
    {
      id: "unnamed-start-unnamed-tip",
      source: "unnamed-start",
      target: "unnamed-tip",
      type: "variant",
    },
    {
      id: "sacred-base-sacred-tip",
      source: "sacred-base",
      target: "sacred-tip",
      type: "sacred",
    },
    {
      id: "unnamed-tip-sacred-tip",
      source: "unnamed-tip",
      target: "sacred-tip",
      type: "convergence",
    },
  ],
  nodes: [
    createCommit("sacred-base", {
      branches: ["main"],
      isDefaultBranch: true,
    }),
    createCommit("unnamed-start", { riskScore: 18 }),
    createCommit("unnamed-tip", { isTip: true, riskScore: 18 }),
    createCommit("sacred-tip", {
      branches: ["main"],
      isDefaultBranch: true,
      isMerge: true,
      isTip: true,
    }),
  ],
};
