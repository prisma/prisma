import { errorDuplicateSpaceId } from './errors';

/**
 * Per-space input for {@link planAllSpaces}. One entry per loaded
 * contract space (the application's `'app'` plus each extension that
 * exposes a `contractSpace`).
 *
 * - `priorContract` is `null` for a space that has never been emitted
 *   (no `migrations/<space-id>/contract.json` on disk yet); otherwise it
 *   is the canonical contract value emitted for that space.
 * - `newContract` is the canonical contract value the planner is about
 *   to emit for that space — for app-space, the just-emitted root
 *   `contract.json`; for an extension space, the descriptor's
 *   `contractSpace.contractJson`.
 */
export interface SpacePlanInput<TContract> {
  readonly spaceId: string;
  readonly priorContract: TContract | null;
  readonly newContract: TContract;
}

export interface SpacePlanOutput<TPackage> {
  readonly spaceId: string;
  readonly migrationPackages: readonly TPackage[];
}

/**
 * Iterate the per-space planner across a set of loaded contract spaces
 * and return a deterministic shape regardless of declaration order.
 *
 * Behaviour:
 *
 * - The output is sorted alphabetically by `spaceId`. Two callers
 *   passing the same set of inputs in different orders observe
 *   byte-identical outputs.
 * - The per-space planner (`planSpace`) is called exactly once per
 *   input, in alphabetical-by-spaceId order. Its return value is
 *   attached to the corresponding output entry verbatim.
 * - Duplicate `spaceId`s in the input array throw
 *   `MIGRATION.DUPLICATE_SPACE_ID` before any `planSpace` call runs,
 *   keeping the planner pure when the input is malformed.
 *
 * The signature is generic over `TContract` and `TPackage` because the
 * shape is framework-neutral (SQL family today, Mongo family
 * eventually). Callers wire in whatever contract value and migration
 * package shape their family already speaks.
 *
 * Synchronous: the underlying per-space planner (target's
 * `MigrationPlanner.plan(...)`) is synchronous; callers that need to
 * resolve async I/O (e.g. reading on-disk `contract.json` from disk)
 * resolve it before calling `planAllSpaces` and pass the materialised
 * inputs through.
 */
export function planAllSpaces<TContract, TPackage>(
  inputs: readonly SpacePlanInput<TContract>[],
  planSpace: (input: SpacePlanInput<TContract>) => readonly TPackage[],
): readonly SpacePlanOutput<TPackage>[] {
  const seen = new Set<string>();
  for (const input of inputs) {
    if (seen.has(input.spaceId)) {
      throw errorDuplicateSpaceId(input.spaceId);
    }
    seen.add(input.spaceId);
  }

  const sorted = [...inputs].sort((a, b) => {
    if (a.spaceId < b.spaceId) return -1;
    if (a.spaceId > b.spaceId) return 1;
    return 0;
  });

  return sorted.map((input) => ({
    spaceId: input.spaceId,
    migrationPackages: planSpace(input),
  }));
}
