import assert from "node:assert/strict";
import test from "node:test";

import { parseGitHubRepository } from "./parse-github-repository.ts";

test("accepts a compact owner/repository reference", () => {
  assert.deepEqual(parseGitHubRepository("vercel/next.js"), {
    name: "next.js",
    owner: "vercel",
  });
});

test("accepts a GitHub repository URL and strips its git suffix", () => {
  assert.deepEqual(
    parseGitHubRepository("https://github.com/microsoft/TypeScript.git/"),
    { name: "TypeScript", owner: "microsoft" },
  );
});

test("accepts a bare GitHub URL and a Git SSH remote", () => {
  assert.deepEqual(parseGitHubRepository("github.com/facebook/react/"), {
    name: "react",
    owner: "facebook",
  });
  assert.deepEqual(parseGitHubRepository("git@github.com:nodejs/node.git"), {
    name: "node",
    owner: "nodejs",
  });
});

test("rejects non-GitHub and non-repository URLs", () => {
  assert.equal(parseGitHubRepository("https://gitlab.com/vercel/next.js"), null);
  assert.equal(
    parseGitHubRepository("https://github.com/vercel/next.js/issues"),
    null,
  );
  assert.equal(parseGitHubRepository("not a repository"), null);
});
