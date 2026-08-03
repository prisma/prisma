import { readFile } from 'node:fs/promises';
import { writeContractSnapshot } from '@internal/migration-tools/contract-snapshot-store';
import { errorInvalidRefName } from '@internal/migration-tools/errors';
import { validateRefName, writeRef } from '@internal/migration-tools/refs';
import { ifDefined } from '@internal/utils/defined';

export interface ContractIR {
  readonly contract: unknown;
  readonly contractDts: string;
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

export async function readContractIR(
  contractJson: Record<string, unknown>,
  contractJsonPath: string,
): Promise<ContractIR> {
  const contractDtsPath = contractJsonPath.replace(/\.json$/i, '.d.ts');
  const contractDts = await readFile(contractDtsPath, 'utf-8');
  return { contract: contractJson, contractDts };
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
