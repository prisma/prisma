import { ifDefined } from '@internal/utils/defined';
import { relative } from 'pathe';

import type { GlobalFlags } from '../global-flags';
import { isVerbose } from './helpers';

// EmitContractResult type for CLI output formatting (includes file paths)
export interface EmitContractResult {
  readonly storageHash: string;
  readonly executionHash?: string;
  readonly profileHash: string;
  readonly outDir: string;
  readonly files: {
    readonly json: string;
    readonly dts: string;
  };
  readonly timings: {
    readonly total: number;
  };
}

/**
 * Formats human-readable output for contract emit.
 */
export function formatEmitOutput(result: EmitContractResult, flags: GlobalFlags): string {
  if (flags.quiet) {
    return '';
  }

  const lines: string[] = [];

  // Convert absolute paths to relative paths from cwd
  const jsonPath = relative(process.cwd(), result.files.json);
  const dtsPath = relative(process.cwd(), result.files.dts);

  lines.push(`✔ Emitted contract.json → ${jsonPath}`);
  lines.push(`✔ Emitted contract.d.ts → ${dtsPath}`);
  lines.push(`  storageHash: ${result.storageHash}`);
  if (result.executionHash) {
    lines.push(`  executionHash: ${result.executionHash}`);
  }
  if (result.profileHash) {
    lines.push(`  profileHash: ${result.profileHash}`);
  }
  if (isVerbose(flags, 1)) {
    lines.push(`  Total time: ${result.timings.total}ms`);
  }

  return lines.join('\n');
}

/**
 * Formats JSON output for contract emit.
 */
export function formatEmitJson(result: EmitContractResult): string {
  const output = {
    ok: true,
    storageHash: result.storageHash,
    ...ifDefined('executionHash', result.executionHash),
    ...(result.profileHash ? { profileHash: result.profileHash } : {}),
    outDir: result.outDir,
    files: result.files,
    timings: result.timings,
  };

  return JSON.stringify(output, null, 2);
}
