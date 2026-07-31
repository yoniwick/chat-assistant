/**
 * Rough token estimate. Uses 4 chars/token for Latin text, which is a
 * safe approximation for budgeting purposes.
 */
export function countTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}