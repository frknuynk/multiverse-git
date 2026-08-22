export interface VariantRefCandidate {
  name: string;
  target: { committedDate: string; oid: string } | null;
}

export function selectVariantRefs<T extends VariantRefCandidate>(
  activeRefs: T[],
  fallbackRefs: T[],
  defaultBranchName: string,
  limit: number,
): T[] {
  const selectedRefs: T[] = [];
  const selectedTipOids = new Set<string>();

  for (const ref of [
    ...sortUsableVariantRefs(activeRefs, defaultBranchName),
    ...sortUsableVariantRefs(fallbackRefs, defaultBranchName),
  ]) {
    const tipOid = ref.target?.oid;

    if (!tipOid || selectedTipOids.has(tipOid)) {
      continue;
    }

    selectedTipOids.add(tipOid);
    selectedRefs.push(ref);

    if (selectedRefs.length === limit) {
      break;
    }
  }

  return selectedRefs;
}

function sortUsableVariantRefs<T extends VariantRefCandidate>(
  refs: T[],
  defaultBranchName: string,
) {
  return refs
    .filter(
      (ref) => ref.name !== defaultBranchName && Boolean(ref.target),
    )
    .sort((left, right) => {
      const dateDifference = getCommittedTime(right) - getCommittedTime(left);

      return dateDifference || left.name.localeCompare(right.name);
    });
}

function getCommittedTime(ref: VariantRefCandidate) {
  const committedTime = ref.target
    ? Date.parse(ref.target.committedDate)
    : Number.NEGATIVE_INFINITY;

  return Number.isNaN(committedTime)
    ? Number.NEGATIVE_INFINITY
    : committedTime;
}
