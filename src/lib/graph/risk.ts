export const MEDIUM_RISK_THRESHOLD = 30;
export const HIGH_RISK_THRESHOLD = 75;

export type RiskLevel = "healthy" | "medium" | "high";

export function getRiskLevel(riskScore: number): RiskLevel {
  if (riskScore >= HIGH_RISK_THRESHOLD) {
    return "high";
  }

  if (riskScore >= MEDIUM_RISK_THRESHOLD) {
    return "medium";
  }

  return "healthy";
}
