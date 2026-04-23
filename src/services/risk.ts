import { isBeneficiary } from "./beneficiary.js";
import { HIGH_VALUE_TRANSFER_THRESHOLD } from "./upi.js";
import { getVelocityCount } from "./fraud.js";
import { getPinFailedStreak } from "./pin.js";

export interface RiskFactor {
  name: string;
  label: string;
  score: number;
  triggered: boolean;
}

export type RiskLevel = "low" | "medium" | "high";

export interface RiskResult {
  score: number;
  level: RiskLevel;
  factors: RiskFactor[];
  requiresStepUp: boolean;
}

const STEP_UP_THRESHOLD = 60;
const MEDIUM_THRESHOLD = 30;

export function computeRisk(
  senderId: string,
  receiverId: string,
  amount: number,
): RiskResult {
  const factors: RiskFactor[] = [
    {
      name: "new_beneficiary",
      label: "New payee",
      score: 30,
      triggered: !isBeneficiary(senderId, receiverId),
    },
    {
      name: "high_value",
      label: "High value transfer",
      score: 20,
      triggered: amount >= HIGH_VALUE_TRANSFER_THRESHOLD,
    },
    {
      name: "rapid_retries",
      label: "Rapid transaction velocity",
      score: 25,
      triggered: getVelocityCount(senderId) >= 2,
    },
    {
      name: "pin_failure_streak",
      label: "Recent PIN failures",
      score: 25,
      triggered: getPinFailedStreak(senderId) >= 2,
    },
  ];

  const score = factors
    .filter((f) => f.triggered)
    .reduce((sum, f) => sum + f.score, 0);

  const level: RiskLevel =
    score >= STEP_UP_THRESHOLD
      ? "high"
      : score >= MEDIUM_THRESHOLD
        ? "medium"
        : "low";

  return {
    score,
    level,
    factors,
    requiresStepUp: level === "high",
  };
}
