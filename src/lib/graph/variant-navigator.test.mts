import assert from "node:assert/strict";
import test from "node:test";

import { getVariantFocus } from "./commit-focus.ts";
import { getVariantNavigatorItems } from "./variant-navigator.ts";
import { namedVariantGraph } from "./variant-context.fixtures.ts";
import type { MultiverseGraph, MultiverseNode } from "@/types/multiverse";

function createVariantNode(
  id: string,
  branchName: string,
): MultiverseNode {
  return {
    ...namedVariantGraph.nodes[1],
    id,
    data: {
      ...namedVariantGraph.nodes[1].data,
      branches: [branchName],
      headline: id,
      isTip: true,
    },
  };
}

test("Variant Navigator excludes Sacred Timeline and reports sampled counts", () => {
  assert.deepEqual(getVariantNavigatorItems(namedVariantGraph), [
    {
      name: "feature/timeline-copy",
      tipOid: "variant-tip",
      commitsShown: 2,
      connectsToSacredTimeline: true,
      riskScore: 42,
    },
    {
      name: "feature/other",
      tipOid: "other-tip",
      commitsShown: 1,
      connectsToSacredTimeline: true,
      riskScore: 12,
    },
  ]);
});

test("Variant Navigator orders branches by attention signals deterministically", () => {
  const graph: MultiverseGraph = {
    ...namedVariantGraph,
    branches: [
      ...namedVariantGraph.branches,
      {
        aheadBy: 1,
        color: "#a78bfa",
        isDefault: false,
        name: "feature/alpha",
        riskScore: 42,
        tipOid: "alpha-tip",
      },
      {
        aheadBy: 1,
        color: "#ef4444",
        isDefault: false,
        name: "feature/danger",
        riskScore: 88,
        tipOid: "danger-tip",
      },
    ],
    edges: [
      ...namedVariantGraph.edges,
      {
        id: "sacred-base-alpha-tip",
        source: "sacred-base",
        target: "alpha-tip",
        type: "variant",
      },
      {
        id: "sacred-base-danger-tip",
        source: "sacred-base",
        target: "danger-tip",
        type: "incursion",
      },
    ],
    nodes: [
      ...namedVariantGraph.nodes,
      createVariantNode("alpha-tip", "feature/alpha"),
      createVariantNode("danger-tip", "feature/danger"),
    ],
  };

  assert.deepEqual(
    getVariantNavigatorItems(graph).map((item) => item.name),
    [
      "feature/danger",
      "feature/timeline-copy",
      "feature/alpha",
      "feature/other",
    ],
  );
});

test("Variant Navigator reports an unconnected sampled Variant honestly", () => {
  const graph: MultiverseGraph = {
    ...namedVariantGraph,
    branches: [
      ...namedVariantGraph.branches,
      {
        aheadBy: 1,
        color: "#ef4444",
        isDefault: false,
        name: "feature/unreachable",
        riskScore: 88,
        tipOid: "unreachable-tip",
      },
    ],
    nodes: [
      ...namedVariantGraph.nodes,
      createVariantNode("unreachable-tip", "feature/unreachable"),
    ],
  };

  const unreachable = getVariantNavigatorItems(graph).find(
    (item) => item.name === "feature/unreachable",
  );

  assert.deepEqual(unreachable, {
    name: "feature/unreachable",
    tipOid: "unreachable-tip",
    commitsShown: 1,
    connectsToSacredTimeline: false,
    riskScore: 88,
  });
});

test("direct Variant focus includes only the Variant segment and real Sacred connector", () => {
  const focus = getVariantFocus(namedVariantGraph, "feature/timeline-copy");

  assert.equal(focus.kind, "variant");
  assert.equal(focus.branchName, "feature/timeline-copy");
  assert.deepEqual(Array.from(focus.emphasizedNodeIds).sort(), [
    "sacred-base",
    "variant-start",
    "variant-tip",
  ]);
  assert.deepEqual(Array.from(focus.emphasizedEdgeIds).sort(), [
    "sacred-base-variant-start",
    "variant-start-variant-tip",
  ]);
});
