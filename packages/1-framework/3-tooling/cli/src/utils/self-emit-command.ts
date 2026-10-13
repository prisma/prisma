/** The command that runs a `migration.ts`, repeating the `--config` the CLI was given so it loads the same config. */
export function selfEmitCommand(migrationTs: string, configPath: string | undefined): string {
  return configPath === undefined
    ? `node "${migrationTs}"`
    : `node "${migrationTs}" --config "${configPath}"`;
}
