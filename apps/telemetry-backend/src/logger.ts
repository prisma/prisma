import { initLogger, log } from 'evlog';

// Initialise the evlog singleton exactly once at module load. Re-exporting
// `log` means consumers can `import { log } from './logger'` without each
// caller worrying about lifecycle. `enabled: false` under `NODE_ENV=test`
// keeps vitest output quiet — the server-lifecycle log sites are not part
// of the assertions that exercise this package.
initLogger({
  enabled: process.env['NODE_ENV'] !== 'test',
  env: {
    service: 'telemetry-backend',
    environment: process.env['NODE_ENV'] ?? 'development',
  },
});

export { log };
