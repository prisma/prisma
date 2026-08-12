import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'pathe';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * The package that declares the dependencies a test project needs to resolve.
 *
 * pnpm links dependencies per package, and the CLI package does not declare
 * `@prisma/orm-postgres`, `@prisma/orm-mongo` or `dotenv`. A project in the OS
 * temp directory therefore cannot import them, and a scaffolded
 * `prisma-next.config.ts` written there fails to load. Test projects live
 * under this package so Node walks up into its `node_modules`.
 */
export const fixtureAppDir = join(here, '../fixture-app');

/**
 * Creates an empty project directory inside the fixture package. The `test-`
 * name prefix is what the package's `.gitignore` matches, so nothing a run
 * leaves behind shows up as a repository change.
 */
export function createTestProjectDir(prefix: string): string {
  const dir = join(
    fixtureAppDir,
    `test-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Writes the manifest a test project needs when it must not inherit the
 * fixture package's own name. Emission reads the nearest manifest to decide
 * which package names generated files carry; a manifest naming no published
 * package means every specifier is emitted as authored.
 */
export function writeProjectManifest(projectDir: string): void {
  writeFileSync(
    join(projectDir, 'package.json'),
    `${JSON.stringify({ name: 'cli-test-project', private: true, type: 'module' }, null, 2)}\n`,
    'utf-8',
  );
}
