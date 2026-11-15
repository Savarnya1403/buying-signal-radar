import type { SignalType } from "@prisma/client";
import { z } from "zod";
import { SIGNAL_TYPES } from "@/lib/signals";

export const DEFAULT_ICP_WEIGHTS = {
  industry: 26,
  size: 20,
  geography: 18,
  buyerRole: 16,
  triggerAlignment: 20,
} as const;

export const DEFAULT_SIGNAL_WEIGHTS: Record<SignalType, number> = {
  HIRING: 18,
  FUNDING: 20,
  EXPANSION: 15,
  PRODUCT_LAUNCH: 14,
  TECHNOLOGY_CHANGE: 12,
  PARTNERSHIP: 11,
  LEADERSHIP: 13,
  CUSTOMER_GROWTH: 12,
  CUSTOMER_COMPLAINT: 11,
};

export type IcpWeights = {
  industry: number;
  size: number;
  geography: number;
  buyerRole: number;
  triggerAlignment: number;
};

export type ScoringConfig = {
  icpWeights: IcpWeights;
  signalWeights: Record<SignalType, number>;
  priorityIcpWeight: number;
  prioritySignalWeight: number;
  recencyHalfLifeDays: number;
};

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  icpWeights: { ...DEFAULT_ICP_WEIGHTS },
  signalWeights: { ...DEFAULT_SIGNAL_WEIGHTS },
  priorityIcpWeight: 55,
  prioritySignalWeight: 45,
  recencyHalfLifeDays: 21,
};

const weight = z.number().min(0).max(100);

export const scoringConfigSchema = z.object({
  icpWeights: z.object({
    industry: weight,
    size: weight,
    geography: weight,
    buyerRole: weight,
    triggerAlignment: weight,
  }),
  signalWeights: z.object(
    Object.fromEntries(SIGNAL_TYPES.map((type) => [type, z.number().min(0).max(50)])) as Record<SignalType, z.ZodNumber>,
  ),
  priorityIcpWeight: z.number().min(0).max(100),
  prioritySignalWeight: z.number().min(0).max(100),
  recencyHalfLifeDays: z.number().min(1).max(365),
});

export function mergeScoringConfig(input: unknown): ScoringConfig {
  const parsed = scoringConfigSchema.partial().safeParse(input ?? {});
  if (!parsed.success) return DEFAULT_SCORING_CONFIG;
  const value = parsed.data;
  return {
    icpWeights: { ...DEFAULT_ICP_WEIGHTS, ...(value.icpWeights ?? {}) },
    signalWeights: { ...DEFAULT_SIGNAL_WEIGHTS, ...(value.signalWeights ?? {}) } as Record<SignalType, number>,
    priorityIcpWeight: value.priorityIcpWeight ?? DEFAULT_SCORING_CONFIG.priorityIcpWeight,
    prioritySignalWeight: value.prioritySignalWeight ?? DEFAULT_SCORING_CONFIG.prioritySignalWeight,
    recencyHalfLifeDays: value.recencyHalfLifeDays ?? DEFAULT_SCORING_CONFIG.recencyHalfLifeDays,
  };
}
