import { getSelectedLineage } from "./selected-lineage.ts";
import type { MultiverseGraph } from "@/types/multiverse";

export type CommitFocusKind = "none" | "lineage" | "variant";

export interface CommitFocus {
  branchName: string | null;
  emphasizedEdgeIds: Set<string>;
  emphasizedNodeIds: Set<string>;
  kind: CommitFocusKind;
}

export function getCommitFocus(
  graph: MultiverseGraph,
  selectedCommitId: string | null,
): CommitFocus {
  const selectedCommit = graph.nodes.find(
    (node) => node.id === selectedCommitId,
  );

  if (!selectedCommit) {
    return createEmptyFocus();
  }

  const nonDefaultBranchNames = new Set(
    selectedCommit.data.branches.filter((branchName) =>
      graph.branches.some(
        (branch) => branch.name === branchName && !branch.isDefault,
      ),
    ),
  );

  if (nonDefaultBranchNames.size !== 1) {
    return createLineageFocus(graph, selectedCommit.id);
  }

  const branchName = nonDefaultBranchNames.values().next().value;

  if (!branchName) {
    return createLineageFocus(graph, selectedCommit.id);
  }

  return createVariantFocus(graph, branchName);
}

function createEmptyFocus(): CommitFocus {
  return {
    branchName: null,
    emphasizedEdgeIds: new Set(),
    emphasizedNodeIds: new Set(),
    kind: "none",
  };
}

function createLineageFocus(
  graph: MultiverseGraph,
  selectedCommitId: string,
): CommitFocus {
  const lineage = getSelectedLineage(graph, selectedCommitId);

  return {
    branchName: null,
    emphasizedEdgeIds: lineage.edgeIds,
    emphasizedNodeIds: lineage.nodeIds,
    kind: "lineage",
  };
}

function createVariantFocus(
  graph: MultiverseGraph,
  branchName: string,
): CommitFocus {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const variantNodeIds = new Set(
    graph.nodes
      .filter((node) => node.data.branches.includes(branchName))
      .map((node) => node.id),
  );
  const emphasizedNodeIds = new Set(variantNodeIds);
  const emphasizedEdgeIds = new Set<string>();

  for (const edge of graph.edges) {
    const sourceIsVariant = variantNodeIds.has(edge.source);
    const targetIsVariant = variantNodeIds.has(edge.target);

    if (sourceIsVariant && targetIsVariant) {
      emphasizedEdgeIds.add(edge.id);
      continue;
    }

    if (sourceIsVariant === targetIsVariant) {
      continue;
    }

    const sacredNodeId = sourceIsVariant ? edge.target : edge.source;
    const sacredNode = nodesById.get(sacredNodeId);

    if (!sacredNode?.data.isDefaultBranch) {
      continue;
    }

    emphasizedEdgeIds.add(edge.id);
    emphasizedNodeIds.add(sacredNodeId);
  }

  return {
    branchName,
    emphasizedEdgeIds,
    emphasizedNodeIds,
    kind: "variant",
  };
}
