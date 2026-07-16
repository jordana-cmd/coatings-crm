// Company capabilities profile + floor-system eligibility evaluator.
//
// CANONICAL LOCATION: supabase/functions/_shared/ — Edge Function deploys can
// only bundle imports from inside supabase/functions/, while Vite can import
// from anywhere. The client consumes this via the re-export at
// src/lib/federal/companyProfile.ts. Keep this module dependency-free and
// runtime-neutral (no Deno/npm specifiers) so it works in both runtimes.
//
// Source of truth: "Flooring Bid Zone Map" (updated May 2024).

export const PROFILE_VERSION = "zone-map-2024-05";

export type FloorSystem =
  | "URETHANE_CEMENT"
  | "ESD_FLOORING"
  | "POLISHED_CONCRETE"
  | "CONCRETE_SEALER"
  | "EPOXY_THIN_MIL";

export const FLOOR_SYSTEMS: readonly FloorSystem[] = [
  "URETHANE_CEMENT",
  "ESD_FLOORING",
  "POLISHED_CONCRETE",
  "CONCRETE_SEALER",
  "EPOXY_THIN_MIL",
];

/** OTHER = any US state or territory that is not MI, IN, or OH. */
export type Region = "MI" | "IN" | "OH" | "OTHER";

export type SetAsideCode = "SDVOSBC" | "SDVOSBS" | "VSA" | "VSS";

export interface BaseLocation {
  city: string;
  county: string;
  stateCode: string;
}

export interface CompanyProfile {
  companyName: string;
  certification: "SDVOSB";
  /** Set-aside codes that match the company's certification. */
  setAsideCodes: readonly SetAsideCode[];
  /** The company also bids unrestricted (full-and-open) competitions. */
  bidsFullAndOpen: boolean;
  naicsCodes: { primary: string; secondary: readonly string[] };
  /** Metadata only — no distance/geo scoring is derived from these. */
  baseLocations: readonly BaseLocation[];
  profileVersion: string;
}

export const COMPANY_PROFILE: CompanyProfile = {
  companyName: "Motor City Floors & Coatings",
  certification: "SDVOSB",
  setAsideCodes: ["SDVOSBC", "SDVOSBS", "VSA", "VSS"],
  bidsFullAndOpen: true,
  naicsCodes: { primary: "238330", secondary: ["238110", "238390"] },
  baseLocations: [
    { city: "St. Clair", county: "St. Clair County", stateCode: "MI" },
    { city: "Kalamazoo", county: "Kalamazoo County", stateCode: "MI" },
  ],
  profileVersion: PROFILE_VERSION,
};

/**
 * Effective minimum square footage per (floorSystem, region).
 * null = the system is not offered in that region.
 * The zone map's per-state SF ranges collapse to minimums — there are no maximums.
 */
export const FLOOR_SYSTEM_RULES: Record<FloorSystem, Record<Region, number | null>> = {
  URETHANE_CEMENT: { MI: 250, IN: 250, OH: 250, OTHER: 1000 },
  ESD_FLOORING: { MI: 250, IN: 500, OH: 500, OTHER: 1000 },
  POLISHED_CONCRETE: { MI: 2500, IN: 7500, OH: 7500, OTHER: null },
  CONCRETE_SEALER: { MI: 5000, IN: 15000, OH: 15000, OTHER: null },
  EPOXY_THIN_MIL: { MI: 2500, IN: 5000, OH: 5000, OTHER: null },
};

// ── Eligibility evaluation ──

export type EligibilityStatus = "ELIGIBLE" | "INELIGIBLE" | "NEEDS_REVIEW";

export interface RuleApplied {
  floorSystem: FloorSystem;
  region: Region;
  /** The threshold applied; null when no threshold applies (unknown state, or system not offered). */
  minSquareFeet: number | null;
}

export interface EligibilityResult {
  status: EligibilityStatus;
  /** Human-readable, includes the threshold applied where one exists. */
  reason: string;
  ruleApplied: RuleApplied;
}

export interface FloorSystemEligibilityInput {
  floorSystem: FloorSystem;
  /** USPS code from the solicitation's place of performance; null = not stated. */
  stateCode: string | null;
  /** Square footage from the solicitation; null = not stated. */
  squareFeet: number | null;
}

/** MI/IN/OH map to themselves; any other non-blank value (incl. territories) is OTHER. */
function resolveRegion(stateCode: string): Region {
  const code = stateCode.trim().toUpperCase();
  if (code === "MI" || code === "IN" || code === "OH") return code;
  return "OTHER";
}

function fmtSf(n: number): string {
  return n.toLocaleString("en-US") + " SF";
}

export function evaluateFloorSystemEligibility(
  input: FloorSystemEligibilityInput
): EligibilityResult {
  const { floorSystem, stateCode, squareFeet } = input;

  // Unknown place of performance — never guess a region.
  // Convention: region defaults to OTHER in ruleApplied, with
  // minSquareFeet null to signal that no threshold was actually applied.
  if (stateCode === null || stateCode.trim() === "") {
    return {
      status: "NEEDS_REVIEW",
      reason: `Place of performance state is unknown — cannot determine which ${floorSystem} minimum applies. Review manually.`,
      ruleApplied: { floorSystem, region: "OTHER", minSquareFeet: null },
    };
  }

  const region = resolveRegion(stateCode);
  const minSquareFeet = FLOOR_SYSTEM_RULES[floorSystem][region];

  if (minSquareFeet === null) {
    return {
      status: "INELIGIBLE",
      reason: `${floorSystem} is not offered outside MI/IN/OH (place of performance: ${stateCode.trim().toUpperCase()}).`,
      ruleApplied: { floorSystem, region, minSquareFeet: null },
    };
  }

  // Missing or non-numeric SF never auto-disqualifies.
  if (squareFeet === null || !Number.isFinite(squareFeet)) {
    return {
      status: "NEEDS_REVIEW",
      reason: `Square footage not stated — ${floorSystem} in ${region} requires at least ${fmtSf(minSquareFeet)}. Review manually.`,
      ruleApplied: { floorSystem, region, minSquareFeet },
    };
  }

  if (squareFeet >= minSquareFeet) {
    return {
      status: "ELIGIBLE",
      reason: `${fmtSf(squareFeet)} meets the ${fmtSf(minSquareFeet)} minimum for ${floorSystem} in ${region}.`,
      ruleApplied: { floorSystem, region, minSquareFeet },
    };
  }

  return {
    status: "INELIGIBLE",
    reason: `${fmtSf(squareFeet)} is below the ${fmtSf(minSquareFeet)} minimum for ${floorSystem} in ${region}.`,
    ruleApplied: { floorSystem, region, minSquareFeet },
  };
}

export interface OpportunityEligibilityResult {
  systems: Record<FloorSystem, EligibilityResult>;
  /**
   * ELIGIBLE if any system is eligible; else NEEDS_REVIEW if any system
   * needs review; else INELIGIBLE.
   */
  overall: EligibilityStatus;
}

/**
 * Evaluates all five floor systems against one opportunity. Inferring which
 * floor system a solicitation actually calls for is out of scope — callers
 * either pass a known system to evaluateFloorSystemEligibility or use this
 * to see the full matrix.
 */
export function evaluateOpportunityEligibility(
  stateCode: string | null,
  squareFeet: number | null
): OpportunityEligibilityResult {
  const systems = {} as Record<FloorSystem, EligibilityResult>;
  for (const floorSystem of FLOOR_SYSTEMS) {
    systems[floorSystem] = evaluateFloorSystemEligibility({ floorSystem, stateCode, squareFeet });
  }

  const results = Object.values(systems);
  const overall: EligibilityStatus = results.some((r) => r.status === "ELIGIBLE")
    ? "ELIGIBLE"
    : results.some((r) => r.status === "NEEDS_REVIEW")
      ? "NEEDS_REVIEW"
      : "INELIGIBLE";

  return { systems, overall };
}
