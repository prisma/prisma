import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HYPERDRIVE_VAR = 'WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE';
export const CLOUDFLARE_HYPERDRIVE_VAR = 'CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE';
export const EXAMPLE_ROOT = fileURLToPath(new URL('..', import.meta.url));

export function loadLocalEnv(root = process.cwd()): void {
  const envPath = resolve(root, '.env');
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
}
