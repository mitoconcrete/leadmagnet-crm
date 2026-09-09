export function conversionRate(submissions: number, visitors: number): number {
  if (visitors === 0) return 0;
  return Math.round((submissions / visitors) * 10000) / 10000;
}
