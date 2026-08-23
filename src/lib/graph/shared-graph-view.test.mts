import assert from "node:assert/strict";
import test from "node:test";

import {
  getSharedGraphViewUrl,
  parseSharedGraphView,
} from "./shared-graph-view.ts";

test("prioritizes an explicit Variant focus over a stale timeline range", () => {
  assert.deepEqual(
    parseSharedGraphView({
      timelineEnd: "sacred-8",
      timelineStart: "sacred-4",
      variant: "docs-variant",
    }),
    { branchName: "docs-variant", kind: "variant" },
  );
});

test("requires both Sacred Timeline endpoints for a shared window", () => {
  assert.deepEqual(parseSharedGraphView({ timelineStart: "sacred-4" }), {
    kind: "none",
  });
  assert.deepEqual(
    parseSharedGraphView({
      timelineEnd: "sacred-8",
      timelineStart: "sacred-4",
    }),
    {
      endCommitId: "sacred-8",
      kind: "timeline",
      startCommitId: "sacred-4",
    },
  );
});

test("preserves repository and unrelated URL state when a lens changes", () => {
  assert.equal(
    getSharedGraphViewUrl(
      "https://multiverse-git.local/?repo=vercel%2Fnext.js&mode=monitor#canvas",
      { branchName: "docs-variant", kind: "variant" },
    ),
    "/?repo=vercel%2Fnext.js&mode=monitor&variant=docs-variant#canvas",
  );
  assert.equal(
    getSharedGraphViewUrl(
      "https://multiverse-git.local/?repo=vercel%2Fnext.js&variant=docs-variant",
      { kind: "none" },
    ),
    "/?repo=vercel%2Fnext.js",
  );
});
