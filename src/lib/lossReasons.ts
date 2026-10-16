/**
 * Canonical closed-loss reasons — the single source of truth for every
 * pipeline view (Dashboard touch list, Opportunity detail, Companies, and
 * anything added later). Do not re-declare these lists per component.
 *
 * Mirrored server-side by the CHECK in close_opportunity_loss()
 * (migration 00082) — change both together or the RPC will reject the value.
 */

export const LOSS_REASONS = [
  "Job Cancelled",
  "Other Contractor Relationship",
  "Price",
] as const;

export type LossReason = (typeof LOSS_REASONS)[number];

export function isLossReason(value: string | null | undefined): value is LossReason {
  return value != null && (LOSS_REASONS as readonly string[]).includes(value);
}
