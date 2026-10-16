// SAM.gov search helpers shared by the sam-gov-search Edge Function and its
// vitest suite. Keep this module dependency-free and runtime-neutral (no
// Deno/npm specifiers) so it works in both runtimes — same rule as
// companyProfile.ts.

/** SDVOSB + VA veteran set-aside codes MCFC can bid under. */
export const VETERAN_SET_ASIDES = ["SDVOSBC", "SDVOSBS", "VSA", "VSS"] as const;

/** NAICS sector 23 = Construction (236 building, 237 heavy/civil, 238 trades). */
export const CONSTRUCTION_NAICS_PREFIX = "23";

/**
 * SAM.gov's `ncode` parameter is an exact 6-digit match — a 2-digit sector
 * code like "23" matches no notice, so it can't be used to pull "all
 * construction". The veteran set-aside pass therefore queries by set-aside
 * alone and narrows to construction NAICS client-side with this check.
 */
export function isConstructionNaics(naicsCode: unknown): boolean {
  return (
    typeof naicsCode === "string" &&
    /^\d{6}$/.test(naicsCode.trim()) &&
    naicsCode.trim().startsWith(CONSTRUCTION_NAICS_PREFIX)
  );
}

/** Notice types that are never biddable (the opportunity is already decided or not a buy). */
const NON_BIDDABLE_TYPES = new Set(["award notice", "justification", "sale of surplus property"]);

/**
 * True when a SAM.gov v2 opportunity is an open construction notice worth
 * previewing: 6-digit 23xxxx NAICS, not an award/justification/surplus
 * notice, and a response deadline that is missing (sources sought) or still
 * in the future.
 */
export function isOpenConstructionNotice(item: Record<string, unknown>, now: Date): boolean {
  if (!isConstructionNaics(item.naicsCode)) return false;
  const type = typeof item.type === "string" ? item.type.trim().toLowerCase() : "";
  if (NON_BIDDABLE_TYPES.has(type)) return false;
  const deadline = item.responseDeadLine;
  if (typeof deadline === "string" && deadline.trim()) {
    const t = Date.parse(deadline);
    if (!Number.isNaN(t) && t <= now.getTime()) return false;
  }
  return true;
}

/**
 * True when more than half of a page's notice ids were already seen — the
 * sign that `offset` is being read as a record offset, not a page index.
 */
export function isRepeatPage(seenIds: Set<string>, pageIds: string[]): boolean {
  const ids = pageIds.filter(Boolean);
  if (ids.length === 0) return false;
  const repeats = ids.filter((id) => seenIds.has(id)).length;
  return repeats / ids.length > 0.5;
}

/**
 * Whether to request another page. SAM.gov v2 `offset` is a page index and
 * `limit` caps at 1000. Stop on a short page, once totalRecords is covered,
 * or at the page cap (protects the 1,000-requests/day key quota).
 */
export function shouldFetchNextPage(
  pageIndex: number,
  pageSize: number,
  itemsOnPage: number,
  totalRecords: number | null,
  maxPages: number
): boolean {
  if (pageIndex + 1 >= maxPages) return false;
  if (itemsOnPage < pageSize) return false;
  if (totalRecords !== null && (pageIndex + 1) * pageSize >= totalRecords) return false;
  return true;
}
