/**
 * Resolves a user-supplied contract reference to an on-disk contract JSON (snapshot store or emitted contract), shared by db sign and db update --to.
 */

import { readFile } from 'node:fs/promises';
import type { PrismaNextConfig } from '@internal/config/config-types';
import {
  contractSnapshotDir,
  readContractSnapshotJson,
} from '@internal/migration-tools/contract-snapshot-store';
import { MigrationToolsError } from '@internal/migration-tools/errors';
import { parseContractRef } from '@internal/migration-tools/ref-resolution';
import { blindCast } from '@internal/utils/casts';
import { notOk, ok, type Result } from '@internal/utils/result';
import { join } from 'pathe';
import {
  CliStructuredError,
  errorRuntime,
  errorUnexpected,
  mapRefResolutionError,
} from '../../utils/cli-errors';
import { buildReadAggregate } from './contract-space-aggregate-loader';

export interface ResolveContractRefToSnapshotOptions {
  readonly config: PrismaNextConfig;
  readonly migrationsDir: string;
  /** User-supplied contract reference (hash, prefix, ref name, migration dir name, <dir>^, or ./path). */
  readonly refInput: string;
  /** Absolute path of the emitted contract.json (fallback source + snapshot-path derivation). */
  readonly contractPathAbsolute: string;
  /**
   * true (db sign): fall back to the emitted contract when no bundle matches and its
   * storage.storageHash matches; else the 'No contract file found for hash "<hash>"' errorRuntime.
   * false (db update --to): missing bundle = the errorUnexpected 'No migration bundle found for
   * <flag> "<input>" (resolved hash: <hash>)' envelope.
   */
  readonly fallbackToEmitted: boolean;
  /** Flag label for the missing-bundle message. Required when fallbackToEmitted is false. */
  readonly missingBundleFlag?: '--to';
}

export interface ResolveContractRefToSnapshotSuccess {
  readonly hash: string;
  readonly contractJson: Record<string, unknown>;
  /** snapshot → join(contractSnapshotDir(migrationsDir, hash), 'contract.json'); emitted → contractPathAbsolute. */
  readonly contractJsonPath: string;
  readonly source: 'snapshot' | 'emitted';
}

export async function resolveContractRefToSnapshot(
  options: ResolveContractRefToSnapshotOptions,
): Promise<Result<ResolveContractRefToSnapshotSuccess, CliStructuredError>> {
  try {
    const loaded = await buildReadAggregate(options.config, {
      migrationsDir: options.migrationsDir,
    });
    if (!loaded.ok) {
      return notOk(loaded.failure);
    }
    const graph = loaded.value.aggregate.app.graph();
    const bundles = loaded.value.aggregate.app.packages;
    const refs = loaded.value.aggregate.app.refs;
    const refResult = parseContractRef(options.refInput, { graph, refs });
    if (!refResult.ok) {
      return notOk(mapRefResolutionError(refResult.failure));
    }
    const targetHash = refResult.value.hash;
    const matchingBundle = bundles.find((p) => p.metadata.to === targetHash);
    if (matchingBundle) {
      const contractJson = blindCast<
        Record<string, unknown>,
        'contract snapshot store entries are JSON objects written by writeContractSnapshot'
      >(await readContractSnapshotJson(options.migrationsDir, targetHash));
      return ok({
        hash: targetHash,
        contractJson,
        contractJsonPath: join(
          contractSnapshotDir(options.migrationsDir, targetHash),
          'contract.json',
        ),
        source: 'snapshot',
      });
    }
    if (!options.fallbackToEmitted) {
      return notOk(
        errorUnexpected(
          `No migration bundle found for ${options.missingBundleFlag} "${options.refInput}" (resolved hash: ${targetHash})`,
          {
            why: `The ref resolved successfully but no on-disk migration package has a destination (\`to\`) hash matching ${targetHash}.`,
            fix: 'Provide a ref or hash that corresponds to an existing migration package, or run `migration list` to see available migrations.',
          },
        ),
      );
    }
    const defaultRaw = await readFile(options.contractPathAbsolute, 'utf-8');
    const defaultContract = blindCast<
      Record<string, unknown>,
      'emitted contract.json is a JSON object produced by contract emit'
    >(JSON.parse(defaultRaw));
    const storageHash = blindCast<
      Record<string, unknown> | undefined,
      'contract.json storage envelope is an object when present'
    >(defaultContract['storage'])?.['storageHash'];
    if (storageHash === targetHash) {
      return ok({
        hash: targetHash,
        contractJson: defaultContract,
        contractJsonPath: options.contractPathAbsolute,
        source: 'emitted',
      });
    }
    return notOk(
      errorRuntime('MIGRATION.SNAPSHOT_MISSING', `No contract file found for hash "${targetHash}"`, {
        why: `Resolved contract reference "${options.refInput}" to hash "${targetHash}" but no migration produces that hash and the emitted contract does not match.`,
        fix: 'Ensure the target contract exists on disk — either as a migration endpoint or as the emitted contract.json.',
      }),
    );
  } catch (error) {
    if (MigrationToolsError.is(error)) {
      return notOk(error);
    }
    if (CliStructuredError.is(error)) {
      return notOk(error);
    }
    throw error;
  }
}
