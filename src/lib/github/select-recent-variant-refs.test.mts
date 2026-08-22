import assert from "node:assert/strict";
import test from "node:test";

import { selectVariantRefs } from "./select-recent-variant-refs.ts";

const ref = (name: string, committedDate: string | null, oid = name) => ({
  name,
  target: committedDate ? { committedDate, oid } : null,
});

test("selects active Variant refs before bounded branch-list fallbacks", () => {
  const activeRefs = [
    ref("active-variant", "2026-08-18T00:00:00.000Z"),
  ];
  const fallbackRefs = [
    ref("main", "2026-08-20T00:00:00.000Z"),
    ref("old-variant", "2026-06-01T00:00:00.000Z"),
    ref("recent-variant", "2026-08-18T00:00:00.000Z"),
    ref("latest-fallback", "2026-08-19T00:00:00.000Z"),
    ref("missing-target", null),
  ];

  assert.deepEqual(
    selectVariantRefs(activeRefs, fallbackRefs, "main", 3).map(
      (candidate) => candidate.name,
    ),
    ["active-variant", "latest-fallback", "recent-variant"],
  );
});

test("deduplicates shared Variant tips and uses branch name as a stable tie breaker", () => {
  const activeRefs = [
    ref("already-active", "2026-08-20T00:00:00.000Z", "same"),
  ];
  const fallbackRefs = [
    ref("duplicate-tip", "2026-08-21T00:00:00.000Z", "same"),
    ref("zeta", "2026-08-19T00:00:00.000Z"),
    ref("alpha", "2026-08-19T00:00:00.000Z"),
  ];

  assert.deepEqual(
    selectVariantRefs(activeRefs, fallbackRefs, "main", 3).map(
      (candidate) => candidate.name,
    ),
    ["already-active", "alpha", "zeta"],
  );
});
