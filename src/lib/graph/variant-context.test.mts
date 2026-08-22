import assert from "node:assert/strict";
import test from "node:test";

// These fixtures exercise panel context mapping without rendering React Flow.
import { getCommitFocus } from "./commit-focus.ts";
import { getVariantContexts } from "./variant-context.ts";
import { getSelectedLineage } from "./selected-lineage.ts";
import {
  namedVariantGraph,
  sacredTimelineGraph,
  unnamedMergeSideGraph,
} from "./variant-context.fixtures.ts";

test("Sacred Timeline commits have no Variant Context", () => {
  assert.deepEqual(getVariantContexts(sacredTimelineGraph, "sacred-tip"), []);
});

test("named Variant commits expose their sampled branch context", () => {
  assert.deepEqual(getVariantContexts(namedVariantGraph, "variant-start"), [
    {
      branchName: "feature/timeline-copy",
      commitsShown: 2,
      connectsToSacredTimeline: true,
      riskScore: 42,
    },
  ]);
});

test("unnamed merge-side commits expose honest fallback Variant Context", () => {
  assert.deepEqual(getVariantContexts(unnamedMergeSideGraph, "unnamed-start"), [
    {
      branchName: null,
      commitsShown: 2,
      connectsToSacredTimeline: true,
      riskScore: 18,
    },
  ]);
});

test("Variant selection follows real ancestry to its Sacred Timeline connection", () => {
  const lineage = getSelectedLineage(namedVariantGraph, "variant-tip");

  assert.deepEqual(Array.from(lineage.nodeIds).sort(), [
    "sacred-base",
    "variant-start",
    "variant-tip",
  ]);
  assert.deepEqual(Array.from(lineage.edgeIds).sort(), [
    "sacred-base-variant-start",
    "variant-start-variant-tip",
  ]);
});

test("Sacred selection excludes merge-side Variant history", () => {
  const lineage = getSelectedLineage(unnamedMergeSideGraph, "sacred-tip");

  assert.deepEqual(Array.from(lineage.nodeIds).sort(), [
    "sacred-base",
    "sacred-tip",
  ]);
  assert.deepEqual(Array.from(lineage.edgeIds), ["sacred-base-sacred-tip"]);
});

test("lineage stops when a sampled parent is absent", () => {
  const graphWithMissingParent = {
    ...namedVariantGraph,
    edges: [
      {
        id: "missing-parent-variant-tip",
        source: "missing-parent",
        target: "variant-tip",
        type: "variant" as const,
      },
    ],
  };

  const lineage = getSelectedLineage(graphWithMissingParent, "variant-tip");

  assert.deepEqual(Array.from(lineage.nodeIds), ["variant-tip"]);
  assert.deepEqual(Array.from(lineage.edgeIds), []);
});

test("named Variant focus includes its visible segment and direct Sacred connector", () => {
  const focus = getCommitFocus(namedVariantGraph, "variant-start");

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

test("named Variant focus excludes unrelated Variant segments", () => {
  const focus = getCommitFocus(namedVariantGraph, "variant-tip");

  assert.equal(focus.emphasizedNodeIds.has("other-tip"), false);
  assert.equal(focus.emphasizedEdgeIds.has("sacred-base-other-tip"), false);
});

test("Sacred Timeline selection uses lineage focus instead of Variant focus", () => {
  const focus = getCommitFocus(unnamedMergeSideGraph, "sacred-tip");

  assert.equal(focus.kind, "lineage");
  assert.equal(focus.branchName, null);
  assert.deepEqual(Array.from(focus.emphasizedNodeIds).sort(), [
    "sacred-base",
    "sacred-tip",
  ]);
  assert.deepEqual(Array.from(focus.emphasizedEdgeIds), [
    "sacred-base-sacred-tip",
  ]);
});

test("unnamed merge-side selection falls back to real lineage", () => {
  const focus = getCommitFocus(unnamedMergeSideGraph, "unnamed-start");

  assert.equal(focus.kind, "lineage");
  assert.equal(focus.branchName, null);
  assert.deepEqual(Array.from(focus.emphasizedNodeIds).sort(), [
    "sacred-base",
    "unnamed-start",
  ]);
  assert.deepEqual(Array.from(focus.emphasizedEdgeIds), [
    "sacred-base-unnamed-start",
  ]);
});

test("ambiguous Variant membership falls back to real lineage", () => {
  const ambiguousGraph = {
    ...namedVariantGraph,
    nodes: namedVariantGraph.nodes.map((node) =>
      node.id === "variant-start"
        ? {
            ...node,
            data: {
              ...node.data,
              branches: ["feature/timeline-copy", "feature/other"],
            },
          }
        : node,
    ),
  };
  const focus = getCommitFocus(ambiguousGraph, "variant-start");

  assert.equal(focus.kind, "lineage");
  assert.equal(focus.branchName, null);
  assert.deepEqual(Array.from(focus.emphasizedNodeIds).sort(), [
    "sacred-base",
    "variant-start",
  ]);
  assert.deepEqual(Array.from(focus.emphasizedEdgeIds), [
    "sacred-base-variant-start",
  ]);
});

test("Variant focus never invents an absent Sacred connector", () => {
  const graphWithoutConnector = {
    ...namedVariantGraph,
    edges: namedVariantGraph.edges.filter(
      (edge) => edge.id !== "sacred-base-variant-start",
    ),
  };
  const focus = getCommitFocus(graphWithoutConnector, "variant-tip");

  assert.deepEqual(Array.from(focus.emphasizedNodeIds).sort(), [
    "variant-start",
    "variant-tip",
  ]);
  assert.deepEqual(Array.from(focus.emphasizedEdgeIds), [
    "variant-start-variant-tip",
  ]);
});
