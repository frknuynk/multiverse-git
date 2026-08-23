import assert from "node:assert/strict";
import test from "node:test";

import {
  getInitialTimelineWindowRange,
  getSacredTimelineNodeIds,
  getTimelineWindowRangeForCommitIds,
  getTimelineWindow,
} from "./timeline-window.ts";
import type { MultiverseGraph, MultiverseNode } from "@/types/multiverse";

function createNode(
  id: string,
  isDefaultBranch: boolean,
): MultiverseNode {
  return {
    data: {
      author: { email: "tva@example.test", name: "TVA" },
      branches: [isDefaultBranch ? "main" : "feature/format"],
      committedDate: "2026-08-22T00:00:00.000Z",
      headline: id,
      isDefaultBranch,
      isMerge: false,
      isNexus: !isDefaultBranch,
      isTip: false,
      message: id,
      parents: [],
      riskScore: 0,
      url: `https://example.test/${id}`,
    },
    id,
    position: { x: 0, y: 0 },
    type: "commit",
  };
}

const timelineFixture: MultiverseGraph = {
  branches: [
    {
      aheadBy: 0,
      color: "#f5a623",
      isDefault: true,
      name: "main",
      riskScore: 0,
      tipOid: "sacred-3",
    },
    {
      aheadBy: 2,
      color: "#22d3ee",
      isDefault: false,
      name: "feature/format",
      riskScore: 12,
      tipOid: "variant-2",
    },
  ],
  edges: [
    { id: "s1-s2", source: "sacred-1", target: "sacred-2", type: "sacred" },
    { id: "s2-s3", source: "sacred-2", target: "sacred-3", type: "sacred" },
    { id: "s2-v1", source: "sacred-2", target: "variant-1", type: "variant" },
    { id: "v1-v2", source: "variant-1", target: "variant-2", type: "variant" },
    { id: "v2-s3", source: "variant-2", target: "sacred-3", type: "convergence" },
  ],
  // Deliberately newest-first to prove timeline order comes from Sacred edges.
  nodes: [
    createNode("sacred-3", true),
    createNode("variant-2", false),
    createNode("sacred-1", true),
    createNode("variant-1", false),
    createNode("sacred-2", true),
  ],
};

test("orders the Sacred Timeline through real Sacred edges", () => {
  assert.deepEqual(getSacredTimelineNodeIds(timelineFixture), [
    "sacred-1",
    "sacred-2",
    "sacred-3",
  ]);
});

test("keeps only the visible Sacred interval and its real Variant segment", () => {
  const window = getTimelineWindow(timelineFixture, {
    endIndex: 1,
    startIndex: 1,
  });

  assert.deepEqual(Array.from(window.visibleNodeIds).sort(), [
    "sacred-2",
    "variant-1",
    "variant-2",
  ]);
  assert.deepEqual(Array.from(window.visibleEdgeIds).sort(), [
    "s2-v1",
    "v1-v2",
  ]);
});

test("drops a connector when its Sacred endpoint is outside the window", () => {
  const window = getTimelineWindow(timelineFixture, {
    endIndex: 1,
    startIndex: 0,
  });

  assert.equal(window.visibleNodeIds.has("sacred-3"), false);
  assert.equal(window.visibleEdgeIds.has("v2-s3"), false);
  assert.equal(window.visibleEdgeIds.has("s1-s2"), true);
});

test("returns the current graph unchanged for the full Sacred Timeline", () => {
  const window = getTimelineWindow(timelineFixture, {
    endIndex: 2,
    startIndex: 0,
  });

  assert.equal(window.isFullTimeline, true);
  assert.deepEqual(Array.from(window.visibleNodeIds).sort(), [
    "sacred-1",
    "sacred-2",
    "sacred-3",
    "variant-1",
    "variant-2",
  ]);
  assert.deepEqual(Array.from(window.visibleEdgeIds).sort(), [
    "s1-s2",
    "s2-s3",
    "s2-v1",
    "v1-v2",
    "v2-s3",
  ]);
});

test("starts dense samples with a recent readable Sacred Timeline interval", () => {
  const denseGraph = {
    ...timelineFixture,
    nodes: Array.from({ length: 18 }, (_, index) =>
      createNode(`sacred-${index + 1}`, true),
    ),
    edges: Array.from({ length: 17 }, (_, index) => ({
      id: `sacred-${index + 1}-sacred-${index + 2}`,
      source: `sacred-${index + 1}`,
      target: `sacred-${index + 2}`,
      type: "sacred" as const,
    })),
  };

  assert.deepEqual(getInitialTimelineWindowRange(denseGraph, 6), {
    endIndex: 17,
    startIndex: 12,
  });
  assert.deepEqual(getInitialTimelineWindowRange(timelineFixture, 6), {
    endIndex: Number.MAX_SAFE_INTEGER,
    startIndex: 0,
  });
});

test("resolves a shared Sacred Timeline range only from real Sacred commit ids", () => {
  assert.deepEqual(
    getTimelineWindowRangeForCommitIds(
      timelineFixture,
      "sacred-2",
      "sacred-3",
    ),
    { endIndex: 2, startIndex: 1 },
  );
  assert.equal(
    getTimelineWindowRangeForCommitIds(
      timelineFixture,
      "variant-1",
      "sacred-3",
    ),
    null,
  );
});
