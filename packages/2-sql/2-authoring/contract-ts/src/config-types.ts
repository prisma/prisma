import { pathToFileURL } from 'node:url';
import type { ContractConfig } from '@prisma-next/config/config-types';
import { applySpecifierDefaultControlPolicy } from '@prisma-next/contract/apply-specifier-default-control-policy';
import type { Contract, ControlPolicy } from '@prisma-next/contract/types';
import type { TargetPackRef } from '@prisma-next/framework-components/components';
import type { SqlNamespaceBase, SqlNamespaceInput } from '@prisma-next/sql-contract/types';
import { ifDefined } from '@prisma-next/utils/defined';
import { InternalError } from '@prisma-next/utils/internal-error';
import { ok } from '@prisma-next/utils/result';
import { extname } from 'pathe';
import { buildSqlContractFromDefinition } from './build-contract';
import { contractError } from './contract-errors';

/**
 * Derives the emit output path from the TS contract input so artefacts land
 * colocated with the source (e.g. `prisma/contract.ts` →
 * `prisma/contract.json`). Mirrors the same default-derivation logic in
 * `@prisma-next/sql-contract-psl/provider`.
 */
function defaultOutputFromContractPath(contractPath: string): string {
  const ext = extname(contractPath);
  if (ext.length === 0) return `${contractPath}.json`;
  return `${contractPath.slice(0, -ext.length)}.json`;
}

export interface TypeScriptContractSpecifierOptions {
  readonly defaultControlPolicy?: ControlPolicy;
}

export function emptyContract(options: {
  readonly output?: string;
  readonly target: TargetPackRef<'sql', string>;
  readonly createNamespace: (input: SqlNamespaceInput) => SqlNamespaceBase;
  readonly defaultControlPolicy?: ControlPolicy;
}): ContractConfig {
  return {
    source: {
      format: 'typescript',
      load: async () => {
        const built = buildSqlContractFromDefinition({
          warnings: undefined,
          target: options.target,
          createNamespace: options.createNamespace,
          models: [],
        });
        return ok(applySpecifierDefaultControlPolicy(built, options.defaultControlPolicy));
      },
    },
    ...ifDefined('output', options.output),
  };
}

export function typescriptContract(
  contract: Contract,
  output?: string,
  options?: TypeScriptContractSpecifierOptions,
): ContractConfig {
  return {
    source: {
      format: 'typescript',
      load: async () =>
        ok(applySpecifierDefaultControlPolicy(contract, options?.defaultControlPolicy)),
    },
    // The in-memory variant has no input path to anchor on; fall through to
    // the global default in `normalizeContractConfig` when caller doesn't pin it.
    ...ifDefined('output', output),
  };
}

export function typescriptContractFromPath(
  contractPath: string,
  output?: string,
  options?: TypeScriptContractSpecifierOptions,
): ContractConfig {
  return {
    source: {
      format: 'typescript',
      inputs: [contractPath],
      load: async (context) => {
        const [absolutePath] = context.resolvedInputs;
        if (absolutePath === undefined) {
          throw new InternalError(
            'typescriptContractFromPath: context.resolvedInputs is empty. The CLI config loader should populate it positional-matched with source.inputs.',
          );
        }
        const mod = await import(pathToFileURL(absolutePath).href);
        const contract: Contract | undefined = mod.default ?? mod.contract;
        if (contract === undefined) {
          throw contractError(
            'CONTRACT.MODULE_EXPORT_MISSING',
            `typescriptContractFromPath: module at "${absolutePath}" has no "default" or "contract" export.`,
            { meta: { path: absolutePath } },
          );
        }
        return ok(applySpecifierDefaultControlPolicy(contract, options?.defaultControlPolicy));
      },
    },
    output: output ?? defaultOutputFromContractPath(contractPath),
  };
}
