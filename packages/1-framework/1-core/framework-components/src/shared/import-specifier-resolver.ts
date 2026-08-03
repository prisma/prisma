/**
 * Rewrites one module specifier for the import root a generated file is being
 * emitted for. Specifiers the root does not govern — relative paths, `node:`
 * builtins, third-party packages — come back unchanged.
 *
 * Emission is handed a resolver rather than a mode because the map from
 * workspace names to published names is packaging data (ADR 242), which
 * `@internal/publish-surface/import-roots` owns. Nothing here needs to know
 * what the published names are.
 */
export type ImportSpecifierResolver = (specifier: string) => string;

/**
 * Emits every specifier exactly as authored. This is the default everywhere:
 * generated files keep naming workspace packages until every consumer in the
 * repository imports published names instead.
 */
export const keepInternalSpecifiers: ImportSpecifierResolver = (specifier) => specifier;

/**
 * Applies a resolver to an assembled import-requirement list, once, after
 * every contributor has added its requirements.
 *
 * Each target's migration renderer does exactly this, and doing it here rather
 * than per renderer is what makes "applied once to the whole list" a property
 * of the emission surface instead of three coincidences. Omitting the resolver
 * means {@link keepInternalSpecifiers}.
 */
export function resolveRequirementSpecifiers<T extends { readonly moduleSpecifier: string }>(
  requirements: readonly T[],
  resolve: ImportSpecifierResolver = keepInternalSpecifiers,
): Array<Omit<T, 'moduleSpecifier'> & { readonly moduleSpecifier: string }> {
  return requirements.map((requirement) => ({
    ...requirement,
    moduleSpecifier: resolve(requirement.moduleSpecifier),
  }));
}
