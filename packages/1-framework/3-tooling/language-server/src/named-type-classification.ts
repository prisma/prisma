import type { NamedTypeSymbol } from '@internal/psl-parser';

/**
 * Presentation-level classification of a `types {}` binding: a
 * non-constructor binding whose base is a configured scalar type refines that
 * scalar (rendered as a default-library type); everything else reads as a
 * plain alias. The authoritative scalar-or-not pronouncement lives in the
 * interpreter's named-type resolution — this mirrors it for display only.
 */
export function refinesScalarType(
  symbol: NamedTypeSymbol,
  scalarTypes: readonly string[],
): boolean {
  return (
    !symbol.isConstructor && symbol.baseType !== undefined && scalarTypes.includes(symbol.baseType)
  );
}
