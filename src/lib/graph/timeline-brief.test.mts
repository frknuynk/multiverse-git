import assert from "node:assert/strict";
import test from "node:test";

import { fakeMultiverseGraph } from "./fake-multiverse-graph.ts";
import { getTimelineBrief } from "./timeline-brief.ts";

test("summarizes real graph semantics without counting repeated Incursion edges", () => {
  assert.deepEqual(getTimelineBrief(fakeMultiverseGraph), {
    cautionVariantCount: 0,
    commitCount: 10,
    convergenceCount: 1,
    healthyVariantCount: 1,
    incursionVariantCount: 1,
    nexusEventCount: 2,
    sacredCommitCount: 6,
    status: "incursion",
    variantCount: 2,
  });
});

test("reports a stable Timeline when a graph has no active Variants", () => {
  const brief = getTimelineBrief({
    ...fakeMultiverseGraph,
    branches: [fakeMultiverseGraph.branches[0]],
  });

  assert.equal(brief.variantCount, 0);
  assert.equal(brief.status, "stable");
  assert.equal(brief.incursionVariantCount, 0);
});
