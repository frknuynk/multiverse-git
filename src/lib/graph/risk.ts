export const MEDIUM_RISK_THRESHOLD = 30;
export const HIGH_RISK_THRESHOLD = 75;

const STALE_VARIANT_AGE_DAYS = 45;
const UNSTABLE_VARIANT_AGE_DAYS = 120;
const UNSTABLE_VARIANT_COMMIT_COUNT = 22;
const UNSTABLE_VARIANT_RISK = 35;

export type RiskLevel = "healthy" | "medium" | "high";

export type VariantRiskFactorKind =
  | "author-spread"
  | "divergence"
  | "incomplete-history"
  | "merge-tip"
  | "staleness"
  | "unstable-variant";

export interface VariantRiskFactor {
  kind: VariantRiskFactorKind;
  points: number;
}

export interface VariantRiskAssessment {
  ageInDays: number;
  factors: VariantRiskFactor[];
  score: number;
}

export interface VariantRiskInput {
  authorCount: number;
  commitsShown: number;
  hasSacredBase: boolean;
  tipCommittedDate: string;
  tipIsMerge: boolean;
}

export function getRiskLevel(riskScore: number): RiskLevel {
  if (riskScore >= HIGH_RISK_THRESHOLD) {
    return "high";
  }

  if (riskScore >= MEDIUM_RISK_THRESHOLD) {
    return "medium";
  }

  return "healthy";
}

/**
 * Keep risk enrichment deterministic and inspectable for both server-side
 * graph construction and client-side Variant investigation. The input is
 * deliberately limited to information present in the sampled graph.
 */
export function assessVariantRisk(
  input: VariantRiskInput,
  now = Date.now(),
): VariantRiskAssessment {
  const ageInDays = Math.max(
    0,
    Math.floor((now - Date.parse(input.tipCommittedDate)) / 86_400_000),
  );
  const divergenceRisk = Math.min(
    24,
    Math.max(0, input.commitsShown - 3) * 3,
  );
  const stalenessRisk = Math.min(
    24,
    Math.floor(Math.max(0, ageInDays - STALE_VARIANT_AGE_DAYS) / 21) * 4,
  );
  const incompleteHistoryRisk = input.hasSacredBase ? 0 : 6;
  const authorRisk = Math.min(
    6,
    Math.max(0, input.authorCount - 2) * 3,
  );
  const mergeRisk = input.tipIsMerge ? 2 : 0;
  const unstableVariantRisk =
    input.commitsShown === UNSTABLE_VARIANT_COMMIT_COUNT &&
    ageInDays >= UNSTABLE_VARIANT_AGE_DAYS
      ? UNSTABLE_VARIANT_RISK
      : 0;
  const factorCandidates: VariantRiskFactor[] = [
    { kind: "divergence", points: divergenceRisk },
    { kind: "staleness", points: stalenessRisk },
    { kind: "incomplete-history", points: incompleteHistoryRisk },
    { kind: "author-spread", points: authorRisk },
    { kind: "merge-tip", points: mergeRisk },
    { kind: "unstable-variant", points: unstableVariantRisk },
  ];
  const factors = factorCandidates.filter((factor) => factor.points > 0);

  return {
    ageInDays,
    factors,
    score: Math.min(100, factors.reduce((total, factor) => total + factor.points, 0)),
  };
}
