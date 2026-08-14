import { loadConfig } from '@internal/config-loader';
import type { LoadedConfig } from '@prisma/cli-engine';
import { resolve } from 'pathe';
import { ORM_CONFIG_SECTION_NAME } from './config-section';
import { toEngineDiagnostic } from './normalize-error';

/** The file the ORM's loader reads when `--config` names none. */
const ORM_CONFIG_FILENAME = 'prisma.config.ts';

/** The pre-consolidation filename, still read as a deprecated fallback. */
const DEPRECATED_ORM_CONFIG_FILENAME = 'prisma-next.config.ts';

export interface LoadOrmConfigOptions {
  /** Where the CLI was invoked. Config discovery starts and ends here. */
  readonly cwd: string;
  /** A non-default config file, resolved against `cwd` when relative. */
  readonly configPath?: string;
  /** Receives one message per deprecated spelling the loader accepted. */
  readonly warn?: (message: string) => void;
}

/**
 * Builds the engine's `Runtime.config` from `prisma.config.ts`.
 *
 * The engine ships its own synchronous loader, but the bin owns the load: the
 * ORM's c12 loader evaluates the module asynchronously and finalizes paths
 * against the config file's own directory. It reads the same shape the engine
 * does — defineConfig from `@prisma/cli-engine` with the whole Prisma Next
 * configuration nested as the single `orm` section — and keeps reading the
 * deprecated `prisma-next.config.ts` filename and flat shape, surfacing each
 * through `warn`.
 *
 * Only failures that prevent evaluation entirely are diagnostics here, and
 * they carry `section: null` so they fail exactly the commands that read
 * config. Structural verdicts belong to the section validator.
 */
export async function loadOrmConfig(options: LoadOrmConfigOptions): Promise<LoadedConfig> {
  const loaded = await loadConfig(options.configPath, { cwd: options.cwd });
  if (!loaded.ok) {
    return {
      path: resolve(options.cwd, options.configPath ?? ORM_CONFIG_FILENAME),
      sections: {},
      diagnostics: [{ section: null, diagnostic: toEngineDiagnostic(loaded.failure) }],
    };
  }
  for (const deprecation of loaded.value.deprecations) {
    options.warn?.(deprecation.message);
  }
  const usedDeprecatedName = loaded.value.deprecations.some(
    (deprecation) => deprecation.code === 'CONFIG.DEPRECATED_FILENAME',
  );
  const filename = usedDeprecatedName ? DEPRECATED_ORM_CONFIG_FILENAME : ORM_CONFIG_FILENAME;
  return {
    path: resolve(options.cwd, options.configPath ?? filename),
    sections: { [ORM_CONFIG_SECTION_NAME]: loaded.value.config },
    diagnostics: [],
  };
}
