import type { MultiverseGraph, MultiverseNode } from "@/types/multiverse";

interface FakeCommitOptions {
  id: string;
  headline: string;
  parents: string[];
  branches: string[];
  x: number;
  y: number;
  riskScore?: number;
  isDefaultBranch?: boolean;
  isMerge?: boolean;
  isNexus?: boolean;
  isTip?: boolean;
}

const author = {
  name: "Avery Stone",
  email: "avery@example.com",
};

const createFakeCommit = ({
  id,
  headline,
  parents,
  branches,
  x,
  y,
  riskScore = 0,
  isDefaultBranch = false,
  isMerge = false,
  isNexus = false,
  isTip = false,
}: FakeCommitOptions): MultiverseNode => ({
  id,
  data: {
    message: headline,
    headline,
    author,
    committedDate: "2026-08-01T09:00:00Z",
    parents,
    branches,
    isDefaultBranch,
    isMerge,
    isNexus,
    isTip,
    url: `https://example.com/commit/${id}`,
    riskScore,
  },
  position: { x, y },
  type: "commit",
});

export const fakeMultiverseGraph: MultiverseGraph = {
  nodes: [
    createFakeCommit({ id: "commit-001", headline: "Initialize repository", parents: [], branches: ["main"], x: 0, y: 240, isDefaultBranch: true }),
    createFakeCommit({ id: "commit-002", headline: "Add project structure", parents: ["commit-001"], branches: ["main"], x: 190, y: 240, isDefaultBranch: true }),
    createFakeCommit({ id: "commit-003", headline: "Create graph contracts", parents: ["commit-002"], branches: ["main"], x: 380, y: 240, isDefaultBranch: true }),
    createFakeCommit({ id: "commit-004", headline: "Prepare release notes", parents: ["commit-003"], branches: ["main"], x: 570, y: 240, isDefaultBranch: true }),
    createFakeCommit({ id: "commit-005", headline: "Convergence: documentation", parents: ["commit-004", "commit-007"], branches: ["main"], x: 760, y: 240, isDefaultBranch: true, isMerge: true }),
    createFakeCommit({ id: "commit-006", headline: "Nexus Event: docs", parents: ["commit-002"], branches: ["docs-variant"], x: 380, y: 40, riskScore: 12, isNexus: true }),
    createFakeCommit({ id: "commit-007", headline: "Clarify setup instructions", parents: ["commit-006"], branches: ["docs-variant"], x: 570, y: 40, riskScore: 18, isTip: true }),
    createFakeCommit({ id: "commit-008", headline: "Tag initial release", parents: ["commit-005"], branches: ["main"], x: 950, y: 240, isDefaultBranch: true, isTip: true }),
    createFakeCommit({ id: "commit-009", headline: "Nexus Event: graph rewrite", parents: ["commit-003"], branches: ["long-running-rewrite"], x: 570, y: 440, riskScore: 68, isNexus: true }),
    createFakeCommit({ id: "commit-010", headline: "Continue graph rewrite", parents: ["commit-009"], branches: ["long-running-rewrite"], x: 760, y: 440, riskScore: 76, isTip: true }),
  ],
  edges: [
    { id: "commit-001-commit-002", source: "commit-001", target: "commit-002", type: "sacred" },
    { id: "commit-002-commit-003", source: "commit-002", target: "commit-003", type: "sacred" },
    { id: "commit-003-commit-004", source: "commit-003", target: "commit-004", type: "sacred" },
    { id: "commit-004-commit-005", source: "commit-004", target: "commit-005", type: "sacred" },
    { id: "commit-005-commit-008", source: "commit-005", target: "commit-008", type: "sacred" },
    { id: "commit-002-commit-006", source: "commit-002", target: "commit-006", type: "variant" },
    { id: "commit-006-commit-007", source: "commit-006", target: "commit-007", type: "variant" },
    { id: "commit-007-commit-005", source: "commit-007", target: "commit-005", type: "convergence" },
    { id: "commit-003-commit-009", source: "commit-003", target: "commit-009", type: "variant" },
    { id: "commit-009-commit-010", source: "commit-009", target: "commit-010", type: "variant" },
  ],
  branches: [
    { name: "main", isDefault: true, tipOid: "commit-008", aheadBy: 0, riskScore: 2, color: "#f5a623" },
    { name: "docs-variant", isDefault: false, tipOid: "commit-007", aheadBy: 0, riskScore: 18, color: "#22d3ee" },
    { name: "long-running-rewrite", isDefault: false, tipOid: "commit-010", aheadBy: 2, riskScore: 76, color: "#ef4444" },
  ],
};
