import assert from "node:assert/strict";
import { test } from "node:test";

import { buildDag, type RawCommit } from "./build-dag.ts";

const baseDate = "2026-01-01T00:00:00Z";

test("builds only real parent to child edges and omits missing ancestry", () => {
  const graph = buildDag(
    [
      commit("main-2", ["main-1"]),
      commit("main-1", ["root"]),
      commit("variant-1", ["missing-base"]),
    ],
    { name: "main", tipOid: "main-2" },
    [{ name: "feature/tva", tipOid: "variant-1" }],
  );

  assert.deepEqual(
    graph.edges.map((edge) => [edge.source, edge.target, edge.type]),
    [["main-1", "main-2", "sacred"]],
  );
  assert.equal(
    graph.branches.find((branch) => branch.name === "feature/tva")?.aheadBy,
    1,
  );
});

test("marks first sampled Variant commit from the Sacred Timeline as a Nexus Event", () => {
  const graph = buildDag(
    [
      commit("main-2", ["main-1"]),
      commit("main-1", []),
      commit("variant-2", ["variant-1"]),
      commit("variant-1", ["main-1"]),
    ],
    { name: "main", tipOid: "main-2" },
    [{ name: "feature/incursion-risk", tipOid: "variant-2" }],
  );

  const nexus = graph.nodes.find((node) => node.id === "variant-1");
  const variantTip = graph.nodes.find((node) => node.id === "variant-2");

  assert.equal(nexus?.data.isNexus, true);
  assert.deepEqual(nexus?.data.branches, ["feature/incursion-risk"]);
  assert.equal(variantTip?.data.isTip, true);
  assert.equal(graph.edges.find((edge) => edge.id === "main-1-variant-1")?.type, "variant");
});

function commit(oid: string, parents: string[]): RawCommit {
  return {
    oid,
    message: `${oid} message`,
    messageHeadline: `${oid} headline`,
    committedDate: baseDate,
    url: `https://github.com/example/repo/commit/${oid}`,
    author: { name: "Mobius", email: "mobius@example.com" },
    parents: { nodes: parents.map((parent) => ({ oid: parent })) },
  };
}
