export type SharedGraphView =
  | { kind: "none" }
  | { branchName: string; kind: "variant" }
  | { endCommitId: string; kind: "timeline"; startCommitId: string };

export interface SharedGraphViewQuery {
  timelineEnd?: string | string[];
  timelineStart?: string | string[];
  variant?: string | string[];
}

const MAX_SHARED_VALUE_LENGTH = 128;

export function parseSharedGraphView(
  query: SharedGraphViewQuery,
): SharedGraphView {
  const branchName = getQueryValue(query.variant);

  if (branchName) {
    return { branchName, kind: "variant" };
  }

  const startCommitId = getQueryValue(query.timelineStart);
  const endCommitId = getQueryValue(query.timelineEnd);

  if (startCommitId && endCommitId) {
    return { endCommitId, kind: "timeline", startCommitId };
  }

  return { kind: "none" };
}

/**
 * Updates only graph-lens query values. The repository query and unrelated
 * application state remain intact, so the URL can be copied as a share link.
 */
export function getSharedGraphViewUrl(
  currentUrl: string,
  view: SharedGraphView,
) {
  const url = new URL(currentUrl);

  url.searchParams.delete("variant");
  url.searchParams.delete("timelineStart");
  url.searchParams.delete("timelineEnd");

  if (view.kind === "variant") {
    url.searchParams.set("variant", view.branchName);
  }

  if (view.kind === "timeline") {
    url.searchParams.set("timelineStart", view.startCommitId);
    url.searchParams.set("timelineEnd", view.endCommitId);
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

function getQueryValue(value: string | string[] | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();

  return normalizedValue && normalizedValue.length <= MAX_SHARED_VALUE_LENGTH
    ? normalizedValue
    : null;
}
