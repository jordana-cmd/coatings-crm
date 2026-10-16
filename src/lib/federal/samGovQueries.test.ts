import { describe, it, expect } from "vitest";
import {
  VETERAN_SET_ASIDES,
  isConstructionNaics,
  isOpenConstructionNotice,
  isRepeatPage,
  shouldFetchNextPage,
} from "../../../supabase/functions/_shared/samGovQueries";

const NOW = new Date("2026-10-16T12:00:00Z");

describe("veteran set-aside codes", () => {
  it("matches the company profile codes", () => {
    expect([...VETERAN_SET_ASIDES]).toEqual(["SDVOSBC", "SDVOSBS", "VSA", "VSS"]);
  });
});

describe("isConstructionNaics", () => {
  it("accepts every 6-digit sector-23 code", () => {
    for (const code of ["236220", "237310", "238330", "238990"]) {
      expect(isConstructionNaics(code)).toBe(true);
    }
  });
  it("rejects other sectors, partial codes and junk", () => {
    for (const code of ["561790", "314110", "23", "2382", "", null, undefined, 236220]) {
      expect(isConstructionNaics(code)).toBe(false);
    }
  });
});

describe("isOpenConstructionNotice", () => {
  const base = { naicsCode: "236220", type: "Solicitation", responseDeadLine: "2026-10-30T16:00:00-04:00" };

  it("keeps an open construction solicitation", () => {
    expect(isOpenConstructionNotice(base, NOW)).toBe(true);
  });
  it("keeps sources sought with no deadline", () => {
    expect(isOpenConstructionNotice({ ...base, type: "Sources Sought", responseDeadLine: null }, NOW)).toBe(true);
  });
  it("drops non-construction NAICS", () => {
    expect(isOpenConstructionNotice({ ...base, naicsCode: "561720" }, NOW)).toBe(false);
  });
  it("drops award notices and justifications", () => {
    expect(isOpenConstructionNotice({ ...base, type: "Award Notice" }, NOW)).toBe(false);
    expect(isOpenConstructionNotice({ ...base, type: "Justification" }, NOW)).toBe(false);
  });
  it("drops notices whose deadline has passed", () => {
    expect(isOpenConstructionNotice({ ...base, responseDeadLine: "2026-10-15T16:00:00-04:00" }, NOW)).toBe(false);
  });
});

describe("isRepeatPage", () => {
  const seen = new Set(["a", "b", "c", "d"]);
  it("flags a page that is mostly already seen (record-offset semantics)", () => {
    expect(isRepeatPage(seen, ["b", "c", "d", "e"])).toBe(true);
  });
  it("accepts a fresh page (page-index semantics)", () => {
    expect(isRepeatPage(seen, ["e", "f", "g", "a"])).toBe(false);
  });
  it("ignores empty pages and blank ids", () => {
    expect(isRepeatPage(seen, [])).toBe(false);
    expect(isRepeatPage(seen, ["", ""])).toBe(false);
  });
});

describe("shouldFetchNextPage", () => {
  it("continues while pages are full and records remain", () => {
    expect(shouldFetchNextPage(0, 1000, 1000, 2500, 5)).toBe(true);
  });
  it("stops on a short page", () => {
    expect(shouldFetchNextPage(0, 1000, 412, null, 5)).toBe(false);
  });
  it("stops once totalRecords is covered", () => {
    expect(shouldFetchNextPage(1, 1000, 1000, 2000, 5)).toBe(false);
  });
  it("stops at the page cap", () => {
    expect(shouldFetchNextPage(4, 1000, 1000, 99999, 5)).toBe(false);
  });
});
