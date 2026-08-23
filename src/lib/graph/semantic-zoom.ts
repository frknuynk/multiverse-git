export const COMMIT_DETAIL_ZOOM_THRESHOLD = 0.55;

export type CommitPresentation = "detail" | "overview";

/**
 * Keep dense graph overviews legible by removing text only when React Flow has
 * scaled individual commit cards below a useful reading size.
 */
export function getCommitPresentation(zoom: number): CommitPresentation {
  return zoom < COMMIT_DETAIL_ZOOM_THRESHOLD ? "overview" : "detail";
}
