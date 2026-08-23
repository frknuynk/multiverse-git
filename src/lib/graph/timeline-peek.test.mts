import assert from "node:assert/strict";
import test from "node:test";

import { fakeMultiverseGraph } from "./fake-multiverse-graph.ts";
import { getTimelinePeek } from "./timeline-peek.ts";

test("maps commit facts into a compact Timeline Peek", () => {
  assert.deepEqual(getTimelinePeek(fakeMultiverseGraph.nodes[5]), {
    authorName: "Avery Stone",
    eventLabel: "Nexus Event",
    headline: "Nexus Event: docs",
    isDefaultBranch: false,
    riskLevel: "healthy",
    riskScore: 12,
  });
});

test("prioritizes a Convergence label when a commit has multiple signals", () => {
  assert.equal(
    getTimelinePeek(fakeMultiverseGraph.nodes[4]).eventLabel,
    "Convergence",
  );
});
