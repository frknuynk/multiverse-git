import assert from "node:assert/strict";
import test from "node:test";

import {
  COMMIT_DETAIL_ZOOM_THRESHOLD,
  getCommitPresentation,
} from "./semantic-zoom.ts";

test("uses overview markers below the readable commit-card zoom threshold", () => {
  assert.equal(getCommitPresentation(COMMIT_DETAIL_ZOOM_THRESHOLD - 0.01), "overview");
  assert.equal(getCommitPresentation(COMMIT_DETAIL_ZOOM_THRESHOLD), "detail");
  assert.equal(getCommitPresentation(0.9), "detail");
});
