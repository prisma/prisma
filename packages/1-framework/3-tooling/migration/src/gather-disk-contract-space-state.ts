import { readContractSpaceHeadRef } from './read-contract-space-head-ref';
import { APP_SPACE_ID } from './space-layout';
import {
  type ContractSpaceHeadRecord,
  listContractSpaceDirectories,
} from './verify-contract-spaces';

/**
 * Disk-side inputs to {@link import('./verify-contract-spaces').verifyContractSpaces}
 * — gathered without touching the live database. The caller composes
 * this with the marker rows it reads from the runtime to invoke the
 * verifier.
 */
export interface DiskContractSpaceState {
  /** Contract-space directory names observed under `<projectMigrationsDir>/`. */
  readonly spaceDirsOnDisk: readonly string[];
  /** Head-ref `(hash, invariants)` per extension space. */
  readonly headRefsBySpace: ReadonlyMap<string, ContractSpaceHeadRecord>;
}

/**
 * Read the on-disk state the per-space verifier needs:
 *
 * - The list of contract-space directories under
 *   `<projectMigrationsDir>/` (via
 *   {@link import('./verify-contract-spaces').listContractSpaceDirectories}).
 * - The on-disk head ref `(hash, invariants)` for each declared extension space
 *   (via {@link readContractSpaceHeadRef}; missing on-disk artefacts are simply
 *   omitted — the verifier reports them as `declaredButUnmigrated`).
 *
 * Synchronous in spirit but async due to filesystem reads. Reads only
 * the user's repo. **Does not import any extension descriptor module.**
 *
 * Composition convention: pure target-agnostic primitive in
 * `1-framework`; the SQL family (and any future target family) wires
 * it into its `dbInit` / `verify` flows alongside its own marker-row
 * read before invoking `verifyContractSpaces`.
 */
export async function gatherDiskContractSpaceState(args: {
  readonly projectMigrationsDir: string;
  /**
   * Set of space ids the project declares: `'app'` plus each entry in
   * `extensions` whose descriptor exposes a `contractSpace`. The
   * helper reads on-disk head data only for the extension spaces.
   */
  readonly loadedSpaceIds: ReadonlySet<string>;
}): Promise<DiskContractSpaceState> {
  const { projectMigrationsDir, loadedSpaceIds } = args;

  const spaceDirsOnDisk = await listContractSpaceDirectories(projectMigrationsDir);

  const headRefsBySpace = new Map<string, ContractSpaceHeadRecord>();
  for (const spaceId of loadedSpaceIds) {
    if (spaceId === APP_SPACE_ID) continue;
    const head = await readContractSpaceHeadRef(projectMigrationsDir, spaceId);
    if (head !== null) {
      headRefsBySpace.set(spaceId, head);
    }
  }

  return { spaceDirsOnDisk, headRefsBySpace };
}
