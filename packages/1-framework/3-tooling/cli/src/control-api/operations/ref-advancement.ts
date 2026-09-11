import { readFile } from 'node:fs/promises';
import { writeContractSnapshot } from '@internal/migration-tools/contract-snapshot-store';
import { errorInvalidRefName, MigrationToolsError } from '@internal/migration-tools/errors';
import { validateRefName, writeRef } from '@internal/migration-tools/refs';
import { ifDefined } from '@internal/utils/defined';
import { notOk, ok, type Result } from '@internal/utils/result';
import { CliStructuredError, errorFileNotFound } from '../../utils/cli-errors';

export interface ContractIR {
  readonly contract: unknown;
  readonly contractDts: string;
}

/** A contract.json and its path; the sibling .d.ts is read when the ref is advanced. */
export interface ContractIRSource {
  readonly contractJson: Record<string, unknown>;
  readonly contractJsonPath: string;
}

export interface RefAdvancementFields {
  readonly advancedRef: { readonly name: string; readonly hash: string } | null;
  readonly plannedAdvanceRef: { readonly name: string; readonly hash: string } | null;
}

export function computeRefAdvancementName(options: {
  readonly advanceRef?: string;
  readonly db?: string;
}): string | null {
  if (options.advanceRef !== undefined) {
    return options.advanceRef;
  }
  if (options.db === undefined) {
    return 'db';
  }
  return null;
}

function contractDtsPathOf(contractJsonPath: string): string {
  return contractJsonPath.replace(/\.json$/i, '.d.ts');
}

export async function readContractIR(
  contractJson: Record<string, unknown>,
  contractJsonPath: string,
): Promise<ContractIR> {
  const contractDts = await readFile(contractDtsPathOf(contractJsonPath), 'utf-8');
  return { contract: contractJson, contractDts };
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && Reflect.get(error, 'code') === 'ENOENT';
}

async function loadContractIR(source: ContractIR | ContractIRSource): Promise<ContractIR> {
  if ('contractDts' in source) {
    return source;
  }
  try {
    return await readContractIR(source.contractJson, source.contractJsonPath);
  } catch (error) {
    if (isMissingFile(error)) {
      const contractDtsPath = contractDtsPathOf(source.contractJsonPath);
      throw errorFileNotFound(contractDtsPath, {
        why: `The contract types next to ${source.contractJsonPath} are missing: ${contractDtsPath}`,
        fix: 'Run {bin} contract emit to regenerate the contract artifacts, then advance the ref again.',
        cause: error,
      });
    }
    throw error;
  }
}

export async function executeRefAdvancement(
  refsDir: string,
  migrationsDir: string,
  name: string,
  hash: string,
  contractIR: ContractIR,
): Promise<{ name: string; hash: string }> {
  // Validate the ref name before writing anything: writeRef validates it too,
  // but only after the store write below, which would otherwise leave a
  // (harmless, but pointless) orphan store entry on an invalid name.
  if (!validateRefName(name)) {
    throw errorInvalidRefName(name);
  }
  await writeContractSnapshot(migrationsDir, hash, {
    contractJson: contractIR.contract,
    contractDts: contractIR.contractDts,
  });
  await writeRef(refsDir, name, { hash, invariants: [] });
  return { name, hash };
}

export async function buildRefAdvancementFields(options: {
  readonly advanceRef?: string;
  readonly db?: string;
  readonly refsDir: string;
  readonly migrationsDir: string;
  readonly contractIR: ContractIR;
  readonly mode: 'plan' | 'apply';
  readonly hash: string;
}): Promise<RefAdvancementFields> {
  const name = computeRefAdvancementName({
    ...ifDefined('advanceRef', options.advanceRef),
    ...ifDefined('db', options.db),
  });
  if (name === null) {
    return { advancedRef: null, plannedAdvanceRef: null };
  }
  if (options.mode === 'plan') {
    return { advancedRef: null, plannedAdvanceRef: { name, hash: options.hash } };
  }
  const advancedRef = await executeRefAdvancement(
    options.refsDir,
    options.migrationsDir,
    name,
    options.hash,
    options.contractIR,
  );
  return { advancedRef, plannedAdvanceRef: null };
}

export interface ResolveRefAdvancementFieldsOptions {
  readonly advanceRef?: string;
  readonly db?: string;
  readonly refsDir: string;
  readonly migrationsDir: string;
  readonly contractJson: Record<string, unknown>;
  /** Path whose sibling .d.ts readContractIR derives (contract.json path). */
  readonly contractJsonPath: string;
  readonly mode: 'plan' | 'apply';
  readonly hash: string;
}

/**
 * Full ref-advancement phase for db init/update: ok({advancedRef:null, plannedAdvanceRef:null})
 * when computeRefAdvancementName is null; else readContractIR + buildRefAdvancementFields with
 * MigrationToolsError mapped, other errors rethrown.
 */
export async function resolveRefAdvancementFields(
  options: ResolveRefAdvancementFieldsOptions,
): Promise<Result<RefAdvancementFields, CliStructuredError>> {
  if (
    computeRefAdvancementName({
      ...ifDefined('advanceRef', options.advanceRef),
      ...ifDefined('db', options.db),
    }) === null
  ) {
    return ok({ advancedRef: null, plannedAdvanceRef: null });
  }
  try {
    const contractIR = await readContractIR(options.contractJson, options.contractJsonPath);
    const fields = await buildRefAdvancementFields({
      ...ifDefined('advanceRef', options.advanceRef),
      ...ifDefined('db', options.db),
      refsDir: options.refsDir,
      migrationsDir: options.migrationsDir,
      contractIR,
      mode: options.mode,
      hash: options.hash,
    });
    return ok(fields);
  } catch (error) {
    if (MigrationToolsError.is(error)) {
      return notOk(error);
    }
    throw error;
  }
}

/**
 * The --advance-ref tail of migrate and db sign: executeRefAdvancement with structured
 * failures (a MigrationToolsError, or a missing .d.ts when handed a ContractIRSource) passed
 * through as notOk, others rethrown.
 */
export async function advanceRefSafely(args: {
  readonly refsDir: string;
  readonly migrationsDir: string;
  readonly name: string;
  readonly hash: string;
  readonly contractIR: ContractIR | ContractIRSource;
}): Promise<Result<{ readonly name: string; readonly hash: string }, CliStructuredError>> {
  try {
    const contractIR = await loadContractIR(args.contractIR);
    const advanced = await executeRefAdvancement(
      args.refsDir,
      args.migrationsDir,
      args.name,
      args.hash,
      contractIR,
    );
    return ok(advanced);
  } catch (error) {
    if (MigrationToolsError.is(error) || error instanceof CliStructuredError) {
      return notOk(error);
    }
    throw error;
  }
}
