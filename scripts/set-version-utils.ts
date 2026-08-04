// Pure helpers consumed by `set-version.ts`. Kept side-effect-free so
// the unit tests in `set-version-utils.test.ts` can exercise them
// without running the full publish-time version-stamp pipeline.

export interface MutablePackageJson {
  name?: string;
  version?: string;
  private?: boolean;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  [key: string]: unknown;
}

const DEP_FIELDS = [
  'dependencies',
  'peerDependencies',
  'devDependencies',
  'optionalDependencies',
] as const;

/**
 * Rewrite every workspace dep spec in `packageJson` to
 * `workspace:<version>`. Mutates in place. Idempotent: re-running with the
 * same version is a no-op.
 *
 * The literal-version form is the mechanism that gives every published
 * package an exact-version pin on its siblings: pnpm rewrites
 * `workspace:<X.Y.Z>` to exactly `X.Y.Z` at publish time, while resolving to
 * the local workspace package during development.
 *
 * Every scope is rewritten rather than one, because every package in this
 * workspace is versioned in lockstep — the published `@prisma/orm-*` shells,
 * the internal `@internal/*` packages they are built from, and the
 * `@internal/*` development packages alike. Singling out one scope would leave
 * the others pinned at whatever version they were last released under.
 *
 * Non-workspace specs (e.g. caret ranges from the registry, catalog entries)
 * are intentionally left alone; only `workspace:` specifiers are rewritten.
 */
export function rewriteWorkspaceDeps(packageJson: MutablePackageJson, version: string): void {
  for (const field of DEP_FIELDS) {
    const deps = packageJson[field];
    if (!deps) continue;
    for (const [name, spec] of Object.entries(deps)) {
      if (typeof spec !== 'string' || !spec.startsWith('workspace:')) continue;
      deps[name] = `workspace:${version}`;
    }
  }
}

/**
 * Whether a manifest that is NOT a workspace member still versions in
 * lockstep with the workspace. A `workspace:` dep spec is the tell:
 * project-boundary manifests (e.g. `examples/bundle-size/src/postgres`,
 * which exists so the emitter can resolve an import root per database)
 * pin workspace packages and go stale on every bump unless swept.
 * Fixture manifests with only registry-style specs are test data and
 * must be left alone.
 */
export function participatesInLockstep(packageJson: MutablePackageJson): boolean {
  for (const field of DEP_FIELDS) {
    const deps = packageJson[field];
    if (!deps) continue;
    for (const spec of Object.values(deps)) {
      if (typeof spec === 'string' && spec.startsWith('workspace:')) return true;
    }
  }
  return false;
}
