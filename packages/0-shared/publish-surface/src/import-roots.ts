/**
 * Import-root resolution: the one place that turns an internal workspace
 * specifier into the name generated code should carry.
 *
 * Emission writes package names into files the user keeps — generated
 * contract types, scaffolded migrations, `prisma-next init` output. Which
 * name is correct depends on how the application installed Prisma Next, so
 * every emitter resolves through an {@link ImportRoot} rather than hardcoding
 * a specifier. The mapping itself is `./shells`; nothing here duplicates it.
 */

import { publicShells, type ShellName } from './shells';

const INTERNAL_SCOPE = '@prisma-next/';
const PUBLISHED_SCOPE = '@prisma/';

/** An import root that emitted code cannot express. */
export class ImportRootError extends Error {}

export type ImportRootMode = 'internal' | 'facade' | 'platform';

/**
 * The published packages an application depends on directly, from emission's
 * point of view.
 *
 * - `internal` — the repo's own workspace names. Emitted output is unchanged
 *   from before ADR 242; this is the default and stays so until every in-repo
 *   consumer imports published names.
 * - `facade` — the application installed one `@prisma/orm-<database>` package.
 * - `platform` — a decomposed install that wires the platform packages itself.
 */
export type ImportRoot =
  | { readonly mode: 'internal' }
  | { readonly mode: 'facade'; readonly facade: ShellName }
  | { readonly mode: 'platform' };

export const internalImportRoot: ImportRoot = { mode: 'internal' };

/**
 * Rewrites one module specifier for an import root. Specifiers outside the
 * internal scope — relative paths, `node:` builtins, third-party packages —
 * come back unchanged.
 */
export type ImportSpecifierResolver = (specifier: string) => string;

interface OwningShell {
  readonly shell: ShellName;
  readonly entry: string;
}

const owners: ReadonlyMap<string, OwningShell> = buildOwnerIndex();

function buildOwnerIndex(): Map<string, OwningShell> {
  const index = new Map<string, OwningShell>();
  for (const [shell, definition] of publicShells) {
    for (const pkg of definition.packages) {
      const existing = index.get(pkg.name);
      if (existing !== undefined) {
        throw new ImportRootError(
          `${pkg.name} is mapped to both ${existing.shell} and ${shell}; ` +
            'one module may live in only one published package (ADR 242)',
        );
      }
      index.set(pkg.name, { shell, entry: pkg.entry });
    }
  }
  return index;
}

function splitSpecifier(specifier: string): { name: string; subpath: string } {
  const [scope, pkg, ...rest] = specifier.split('/');
  return { name: `${scope}/${pkg}`, subpath: rest.join('/') };
}

function joinEntrypoint(shell: ShellName, entry: string, subpath: string): string {
  const tail = [entry, subpath].filter(Boolean).join('/');
  return tail === '' ? shell : `${shell}/${tail}`;
}

/**
 * The shells an application installs directly under this root. Emitted code
 * may name only these: a package manager puts a package's own dependencies in
 * its own `node_modules`, so importing a transitively installed package fails
 * to resolve at run time even though the files are on disk.
 */
export function directDependencyShells(root: ImportRoot): ReadonlySet<ShellName> {
  const direct = new Set<ShellName>();
  if (root.mode === 'internal') return direct;
  for (const [shell, definition] of publicShells) {
    if (definition.kind === 'extension') direct.add(shell);
    if (root.mode === 'platform' && definition.kind === 'platform') direct.add(shell);
  }
  if (root.mode === 'facade') direct.add(root.facade);
  return direct;
}

function owningShell(specifier: string, name: string): OwningShell {
  const owner = owners.get(name);
  if (owner === undefined) {
    throw new ImportRootError(`${specifier} is not mapped to any published shell`);
  }
  return owner;
}

/**
 * The platform-install name for an internal specifier, with the shell that
 * owns it. The shell build needs both: an import that stays inside the shell
 * being built is bundled rather than externalized.
 */
export function platformEntrypointOf(specifier: string): { shell: ShellName; id: string } {
  const { name, subpath } = splitSpecifier(specifier);
  const owner = owningShell(specifier, name);
  return { shell: owner.shell, id: joinEntrypoint(owner.shell, owner.entry, subpath) };
}

/**
 * The facade's own name for an internal specifier it republishes, or
 * `undefined` when the facade does not carry that surface.
 */
function facadeEntrypoint(facade: ShellName, name: string, subpath: string): string | undefined {
  const definition = publicShells.get(facade);
  if (definition === undefined) throw new ImportRootError(`unknown shell ${facade}`);
  if (definition.kind !== 'facade') {
    throw new ImportRootError(`${facade} is a ${definition.kind} shell, not a facade`);
  }
  for (const reexport of definition.reexports ?? []) {
    if (reexport.package !== name) continue;
    // A `root: false` forward covers subpaths only — the facade's own code
    // already owns the bare entry name.
    if (subpath === '' && reexport.root === false) return undefined;
    return joinEntrypoint(facade, reexport.entry, subpath);
  }
  return undefined;
}

function describe(root: ImportRoot): string {
  return root.mode === 'facade' ? `${root.mode} (${root.facade})` : root.mode;
}

export function resolveImportSpecifier(specifier: string, root: ImportRoot): string {
  if (root.mode === 'internal') return specifier;
  if (!specifier.startsWith(INTERNAL_SCOPE)) return specifier;

  const { name, subpath } = splitSpecifier(specifier);
  if (root.mode === 'facade') {
    const republished = facadeEntrypoint(root.facade, name, subpath);
    if (republished !== undefined) return republished;
  }

  const owner = owningShell(specifier, name);
  const published = joinEntrypoint(owner.shell, owner.entry, subpath);
  if (!directDependencyShells(root).has(owner.shell)) {
    throw new ImportRootError(
      `${specifier} resolves to ${published}, which an application on the ` +
        `${describe(root)} import root does not depend on directly. ` +
        'Emitted code may name only direct dependencies (ADR 242).',
    );
  }
  return published;
}

export function createImportSpecifierResolver(root: ImportRoot): ImportSpecifierResolver {
  if (root.mode === 'internal') return (specifier) => specifier;
  return (specifier) => resolveImportSpecifier(specifier, root);
}

// Generated sources are rendered by `renderImports`, which always writes
// `from '<specifier>'` with single quotes, so scanning for that is enough and
// keeps this package free of a parser dependency.
const FROM_CLAUSE = /\bfrom\s+'([^']+)'/g;

/** The module specifiers a generated source file imports from. */
export function importedSpecifiers(source: string): string[] {
  return [...source.matchAll(FROM_CLAUSE)].map(([, specifier]) => specifier ?? '');
}

/**
 * The specifiers in a generated file that the application would not have as a
 * direct dependency under `root` — the thing no emitted file may contain.
 *
 * Under the `internal` root nothing is reported: those names are the
 * repository's own, and every in-repo consumer resolves them through the
 * workspace.
 */
export function transitiveImports(source: string, root: ImportRoot): string[] {
  if (root.mode === 'internal') return [];
  const direct = new Set<string>(directDependencyShells(root));
  return importedSpecifiers(source).filter((specifier) => {
    if (specifier.startsWith(INTERNAL_SCOPE)) return true;
    if (!specifier.startsWith(PUBLISHED_SCOPE)) return false;
    const [scope, shell] = specifier.split('/');
    return !direct.has(`${scope}/${shell}`);
  });
}
