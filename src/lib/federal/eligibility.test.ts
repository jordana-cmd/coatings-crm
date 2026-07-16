import { describe, it, expect } from "vitest";
import {
  evaluateFloorSystemEligibility,
  evaluateOpportunityEligibility,
  FLOOR_SYSTEM_RULES,
  FLOOR_SYSTEMS,
  COMPANY_PROFILE,
  PROFILE_VERSION,
} from "./companyProfile";

describe("profile data", () => {
  it("carries the zone-map version tag", () => {
    expect(PROFILE_VERSION).toBe("zone-map-2024-05");
    expect(COMPANY_PROFILE.profileVersion).toBe(PROFILE_VERSION);
  });

  it("encodes the full 5-system × 4-region matrix", () => {
    for (const system of FLOOR_SYSTEMS) {
      for (const region of ["MI", "IN", "OH", "OTHER"] as const) {
        expect(FLOOR_SYSTEM_RULES[system][region]).not.toBeUndefined();
      }
    }
  });

  it("matches the SDVOSB set-aside codes", () => {
    expect(COMPANY_PROFILE.setAsideCodes).toEqual(["SDVOSBC", "SDVOSBS", "VSA", "VSS"]);
    expect(COMPANY_PROFILE.naicsCodes.primary).toBe("238330");
  });
});

describe("evaluateFloorSystemEligibility: boundary cases", () => {
  it("MI urethane cement: 249 SF is below the 250 minimum", () => {
    const r = evaluateFloorSystemEligibility({
      floorSystem: "URETHANE_CEMENT", stateCode: "MI", squareFeet: 249,
    });
    expect(r.status).toBe("INELIGIBLE");
    expect(r.reason).toContain("250");
    expect(r.ruleApplied).toEqual({ floorSystem: "URETHANE_CEMENT", region: "MI", minSquareFeet: 250 });
  });

  it("MI urethane cement: 250 SF meets the minimum (inclusive)", () => {
    const r = evaluateFloorSystemEligibility({
      floorSystem: "URETHANE_CEMENT", stateCode: "MI", squareFeet: 250,
    });
    expect(r.status).toBe("ELIGIBLE");
  });

  it("OTHER-state urethane cement: 999 SF is below the 1,000 nationwide minimum", () => {
    const r = evaluateFloorSystemEligibility({
      floorSystem: "URETHANE_CEMENT", stateCode: "TX", squareFeet: 999,
    });
    expect(r.status).toBe("INELIGIBLE");
    expect(r.ruleApplied.region).toBe("OTHER");
    expect(r.ruleApplied.minSquareFeet).toBe(1000);
  });

  it("OTHER-state urethane cement: 1,000 SF meets the nationwide minimum", () => {
    const r = evaluateFloorSystemEligibility({
      floorSystem: "URETHANE_CEMENT", stateCode: "TX", squareFeet: 1000,
    });
    expect(r.status).toBe("ELIGIBLE");
  });

  it("IN ESD flooring: 499 SF is below the 500 minimum", () => {
    const r = evaluateFloorSystemEligibility({
      floorSystem: "ESD_FLOORING", stateCode: "IN", squareFeet: 499,
    });
    expect(r.status).toBe("INELIGIBLE");
    expect(r.ruleApplied.minSquareFeet).toBe(500);
  });

  it("IN ESD flooring: 500 SF meets the minimum", () => {
    const r = evaluateFloorSystemEligibility({
      floorSystem: "ESD_FLOORING", stateCode: "IN", squareFeet: 500,
    });
    expect(r.status).toBe("ELIGIBLE");
  });
});

describe("evaluateFloorSystemEligibility: regional availability", () => {
  it("polished concrete in an OTHER state is not offered, regardless of size", () => {
    const r = evaluateFloorSystemEligibility({
      floorSystem: "POLISHED_CONCRETE", stateCode: "FL", squareFeet: 100000,
    });
    expect(r.status).toBe("INELIGIBLE");
    expect(r.reason).toContain("not offered outside MI/IN/OH");
    expect(r.ruleApplied).toEqual({ floorSystem: "POLISHED_CONCRETE", region: "OTHER", minSquareFeet: null });
  });

  it("territories resolve to OTHER", () => {
    const r = evaluateFloorSystemEligibility({
      floorSystem: "CONCRETE_SEALER", stateCode: "PR", squareFeet: 50000,
    });
    expect(r.status).toBe("INELIGIBLE");
    expect(r.ruleApplied.region).toBe("OTHER");
  });

  it("state codes normalize (lowercase, padded)", () => {
    const r = evaluateFloorSystemEligibility({
      floorSystem: "EPOXY_THIN_MIL", stateCode: " mi ", squareFeet: 2500,
    });
    expect(r.status).toBe("ELIGIBLE");
    expect(r.ruleApplied.region).toBe("MI");
  });
});

describe("evaluateFloorSystemEligibility: missing data never auto-disqualifies", () => {
  it("null square footage → NEEDS_REVIEW with the threshold stated", () => {
    const r = evaluateFloorSystemEligibility({
      floorSystem: "URETHANE_CEMENT", stateCode: "OH", squareFeet: null,
    });
    expect(r.status).toBe("NEEDS_REVIEW");
    expect(r.reason).toContain("250");
    expect(r.ruleApplied.minSquareFeet).toBe(250);
  });

  it("null state → NEEDS_REVIEW, no threshold applied", () => {
    const r = evaluateFloorSystemEligibility({
      floorSystem: "URETHANE_CEMENT", stateCode: null, squareFeet: 5000,
    });
    expect(r.status).toBe("NEEDS_REVIEW");
    expect(r.ruleApplied.minSquareFeet).toBeNull();
  });

  it("blank state is treated as unknown, not OTHER", () => {
    const r = evaluateFloorSystemEligibility({
      floorSystem: "URETHANE_CEMENT", stateCode: "  ", squareFeet: 5000,
    });
    expect(r.status).toBe("NEEDS_REVIEW");
  });

  it("NaN square footage is treated as not stated", () => {
    const r = evaluateFloorSystemEligibility({
      floorSystem: "URETHANE_CEMENT", stateCode: "MI", squareFeet: NaN,
    });
    expect(r.status).toBe("NEEDS_REVIEW");
  });
});

describe("evaluateOpportunityEligibility: overall aggregation", () => {
  it("ELIGIBLE when any system qualifies (MI, 3,000 SF)", () => {
    const r = evaluateOpportunityEligibility("MI", 3000);
    expect(r.systems.URETHANE_CEMENT.status).toBe("ELIGIBLE");
    expect(r.systems.POLISHED_CONCRETE.status).toBe("ELIGIBLE"); // 3,000 ≥ 2,500
    expect(r.systems.CONCRETE_SEALER.status).toBe("INELIGIBLE"); // 3,000 < 5,000
    expect(r.overall).toBe("ELIGIBLE");
  });

  it("INELIGIBLE when every system fails (OTHER state, 500 SF)", () => {
    const r = evaluateOpportunityEligibility("GA", 500);
    // Urethane/ESD below 1,000 nationwide; the other three not offered
    expect(r.overall).toBe("INELIGIBLE");
    for (const system of FLOOR_SYSTEMS) {
      expect(r.systems[system].status).toBe("INELIGIBLE");
    }
  });

  it("NEEDS_REVIEW when nothing is eligible but review is possible (OTHER state, null SF)", () => {
    const r = evaluateOpportunityEligibility("AZ", null);
    // Urethane/ESD → NEEDS_REVIEW (threshold exists, SF unknown);
    // remaining systems → INELIGIBLE (not offered)
    expect(r.systems.URETHANE_CEMENT.status).toBe("NEEDS_REVIEW");
    expect(r.systems.POLISHED_CONCRETE.status).toBe("INELIGIBLE");
    expect(r.overall).toBe("NEEDS_REVIEW");
  });

  it("NEEDS_REVIEW when the state is unknown", () => {
    const r = evaluateOpportunityEligibility(null, 10000);
    expect(r.overall).toBe("NEEDS_REVIEW");
  });
});
