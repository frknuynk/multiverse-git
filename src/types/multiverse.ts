export type CommitNodeType = "commit";

export type MultiverseEdgeType =
  | "sacred"
  | "variant"
  | "convergence"
  | "incursion";

export interface CommitAuthor {
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface GraphPosition {
  x: number;
  y: number;
}

export interface MultiverseNodeData {
  message: string;
  headline: string;
  author: CommitAuthor;
  committedDate: string;
  parents: string[];
  branches: string[];
  isDefaultBranch: boolean;
  isMerge: boolean;
  isNexus: boolean;
  isTip: boolean;
  url: string;
  riskScore: number;
}

export interface MultiverseNode {
  id: string;
  data: MultiverseNodeData;
  position: GraphPosition;
  type: CommitNodeType;
}

export interface MultiverseEdge {
  id: string;
  source: string;
  target: string;
  type: MultiverseEdgeType;
}

export interface BranchInfo {
  name: string;
  isDefault: boolean;
  tipOid: string;
  aheadBy: number;
  riskScore: number;
  color: string;
}

export interface MultiverseGraph {
  nodes: MultiverseNode[];
  edges: MultiverseEdge[];
  branches: BranchInfo[];
}
