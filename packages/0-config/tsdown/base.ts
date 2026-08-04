import { defineConfig as defineConfigOriginal, type UserConfig } from 'tsdown';

/**
 * Extend/use the base `tsdown` config with custom settings.
 *
 * See {@link baseConfig} for the default configuration object we use.
 */
export function defineConfig(config?: UserConfig): UserConfig {
  return {
    ...baseConfig,
    ...config,
  };
}

/**
 * Base `tsdown` configuration for the monorepo.
 *
 * You can import and extend this configuration in your package-specific `tsdown.config.ts` files.
 *
 * If you're not doing anything with arrays or functions, opt for {@link defineConfig} instead.
 */
export const baseConfig = defineConfigOriginal({
  dts: {
    enabled: true,
    sourcemap: true,
  },
  exports: {
    customExports: function removeExportsPrefixes(exports) {
      // biome-ignore lint/suspicious/noExplicitAny: it's fine.
      const out: Record<string, any> = {};

      for (let [key, value] of Object.entries(exports)) {
        // omit "exports/" prefixes from the output paths
        key = key.replace(/exports\/?/, '');

        // './' is illegal in package.json exports, replace with '.'
        if (key === './') {
          key = '.';
        }

        // For single-entry packages, tsdown collapses the entry to ".".
        // Derive the subpath from the output filename so e.g. `src/exports/control.ts`
        // produces `./control` instead of `.` (consistent with multi-entry packages).
        if (key === '.' && typeof value === 'string') {
          const match = value.match(/\/([^/]+)\.mjs$/);
          if (match && match[1] !== 'index') {
            key = `./${match[1]}`;
          }
        }

        out[key] = value;
      }

      return out;
    },
    // this enables "live mode" via TypeScript custom conditions for the best DX during development
    // devExports: '@internal/source-code',
    // we don't want drift in NPM, in case someone changed build config and didn't push the package.json changes.
    enabled: 'local-only',
    // cli entrypoints should not be importable by consumers.
    exclude: [/cli\./],
  },
  // override per-package if you want to bundle dev or phantom dependencies.
  skipNodeModulesBundle: true,
  sourcemap: true,
  tsconfig: 'tsconfig.prod.json',
});
