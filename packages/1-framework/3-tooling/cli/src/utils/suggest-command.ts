import { distance } from 'closest-match';

/**
 * Suggests similar command names for a mistyped input.
 *
 * Uses Levenshtein distance to find close matches. Only suggests commands
 * within a reasonable distance threshold (40% of the input length, minimum 2).
 * Returns up to 3 suggestions in case of ties.
 *
 * @returns Array of suggested command names (empty if nothing is close enough).
 */
export function suggestCommands(input: string, candidates: readonly string[]): string[] {
  if (candidates.length === 0) return [];

  // Threshold: at most 40% of the input length (min 2) to avoid absurd suggestions
  const maxDistance = Math.max(2, Math.ceil(input.length * 0.4));

  const scored = candidates
    .map((name) => ({ name, dist: distance(input, name) }))
    .filter((entry) => entry.dist <= maxDistance)
    .sort((a, b) => a.dist - b.dist);

  if (scored.length === 0) return [];

  // Take the best distance, then include ties (up to 3)
  const bestDist = scored[0]!.dist;
  return scored
    .filter((entry) => entry.dist === bestDist)
    .slice(0, 3)
    .map((entry) => entry.name);
}
