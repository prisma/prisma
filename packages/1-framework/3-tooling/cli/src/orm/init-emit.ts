import { join } from 'pathe';

/**
 * Emits the contract for the project `init` has just scaffolded.
 *
 * The config file is the one this run wrote, so it is read here rather than
 * through `needs.config`: `init` runs where no config exists yet, and the
 * engine loads a section before the handler starts. The emitter and the config
 * loader are imported at execution time so a run that skips the install — and
 * therefore skips the emit — never pays for either.
 */
export async function emitScaffoldedContract(ctx: { readonly cwd: string }): Promise<void> {
  const { executeContractEmit } = await import('../control-api/operations/contract-emit');
  const { loadConfigForSections } = await import('@internal/config-loader');
  const configPath = join(ctx.cwd, 'prisma-next.config.ts');
  const loaded = await loadConfigForSections(configPath, [
    'contract',
    'family',
    'target',
    'adapter',
    'extensions',
  ]);
  if (!loaded.ok) {
    throw loaded.failure;
  }
  await executeContractEmit({ config: loaded.value, cwd: ctx.cwd, configPath });
}
