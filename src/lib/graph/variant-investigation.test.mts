import assert from "node:assert/strict";
import test from "node:test";

import { fakeMultiverseGraph } from "./fake-multiverse-graph.ts";
import { getVariantInvestigation } from "./variant-investigation.ts";
import { namedVariantGraph } from "./variant-context.fixtures.ts";

const NOW = Date.parse("2026-08-23T00:00:00.000Z");

test("maps a Variant's real Nexus Event, Convergence, and current risk factors", () => {
  const investigation = getVariantInvestigation(
    fakeMultiverseGraph,
    "docs-variant",
    NOW,
  );

  assert.deepEqual(investigation?.nexusEvent, {
    id: "commit-006",
    headline: "Nexus Event: docs",
  });
  assert.deepEqual(investigation?.convergence, {
    id: "commit-005",
    headline: "Convergence: documentation",
  });
  assert.equal(investigation?.connectsToSacredTimeline, true);
  assert.equal(investigation?.commitsShown, 2);
  assert.equal(investigation?.hasSacredBase, true);
});

test("shows only factors that reproduce the current enriched branch score", () => {
  const graph = {
    ...fakeMultiverseGraph,
    branches: fakeMultiverseGraph.branches.map((branch) =>
      branch.name === "long-running-rewrite"
        ? { ...branch, aheadBy: 22, riskScore: 83 }
        : branch,
    ),
    nodes: fakeMultiverseGraph.nodes.map((node) =>
      node.data.branches.includes("long-running-rewrite")
        ? {
            ...node,
            data: {
              ...node.data,
              committedDate: "2026-01-01T00:00:00.000Z",
            },
          }
        : node,
    ),
  };
  const investigation = getVariantInvestigation(
    graph,
    "long-running-rewrite",
    NOW,
  );

  assert.equal(investigation?.scoreMatchesCurrentGraph, true);
  assert.deepEqual(
    investigation?.riskFactors.map((factor) => factor.kind),
    ["divergence", "staleness", "unstable-variant"],
  );
  assert.equal(investigation?.tipAgeInDays, 234);
});

test("keeps a missing Sacred connector honest and never invents a Variant", () => {
  const graphWithoutConnector = {
    ...namedVariantGraph,
    edges: namedVariantGraph.edges.filter(
      (edge) => edge.id !== "sacred-base-variant-start",
    ),
  };
  const investigation = getVariantInvestigation(
    graphWithoutConnector,
    "feature/timeline-copy",
    NOW,
  );

  assert.equal(investigation?.connectsToSacredTimeline, false);
  assert.equal(investigation?.hasSacredBase, false);
  assert.equal(getVariantInvestigation(namedVariantGraph, "main", NOW), null);
});
