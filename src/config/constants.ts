export const ANNUAL_GOAL_CLOSED_WON = 10_000_000;
export const GOAL_YEAR = 2027;
export const QUARTERLY_GOAL = ANNUAL_GOAL_CLOSED_WON / 4;

export function daysElapsedInYear(year: number): number {
  const start = new Date(year, 0, 1);
  const now = new Date();
  if (now.getFullYear() < year) return 0;
  if (now.getFullYear() > year) return 365;
  return Math.floor((now.getTime() - start.getTime()) / 86400000);
}

export function daysInYear(year: number): number {
  return (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365;
}
