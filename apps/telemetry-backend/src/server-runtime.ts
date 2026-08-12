import { createTelemetryDb } from './db';
import { createHandler, type HandlerInfo } from './handler';
import { log } from './logger';
import { createRequestsPerMinuteRateLimiter } from './rate-limiter';

const SHUTDOWN_TIMEOUT_MS = 10_000;

export type TelemetryRequestHandler = (request: Request, info?: HandlerInfo) => Promise<Response>;

export interface TelemetryServerStartOptions {
  readonly port: number;
  readonly handler: TelemetryRequestHandler;
}

export interface TelemetryServer {
  readonly port: number;
  stop(): void | Promise<void>;
}

export type StartTelemetryServer = (
  options: TelemetryServerStartOptions,
) => TelemetryServer | Promise<TelemetryServer>;

export interface TelemetryBackendConfig {
  readonly databaseUrl: string;
  readonly port: number;
  readonly requestsPerMinute: number;
  /**
   * Opt into trusting the first `x-forwarded-for` address for per-IP rate
   * limiting. Set this only when the backend sits behind a proxy that
   * strips inbound `x-forwarded-for` and writes its own. Defaults to
   * false; without a stripping proxy the header is attacker-controlled.
   */
  readonly trustForwardedFor: boolean;
}

export interface TelemetryBackendShutdownTarget {
  close(): Promise<void>;
}

interface TelemetryBackendApp extends TelemetryBackendShutdownTarget {
  readonly handler: TelemetryRequestHandler;
  readonly requestsPerMinute: number;
}

function parsePositiveIntegerFromEnv(
  name: string,
  env: Record<string, string | undefined>,
  fallbackValue: string,
): number {
  const value = env[name] ?? fallbackValue;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name} value: ${value}`);
  }
  return parsed;
}

function parseBooleanEnv(
  name: string,
  env: Record<string, string | undefined>,
  fallback: boolean,
): boolean {
  const raw = env[name];
  if (raw === undefined) return fallback;
  const normalized = raw.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function shutdownTimeout(): Promise<'timed-out'> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve('timed-out'), SHUTDOWN_TIMEOUT_MS);
    timer.unref?.();
  });
}

/**
 * Map a `stopTelemetryBackend` result to a process exit code. A `'timed-out'`
 * shutdown returns `1` so process supervisors (systemd, Kubernetes, Prisma
 * Compute) treat it as a failed shutdown rather than a clean exit.
 */
export function shutdownExitCode(result: 'stopped' | 'timed-out'): 0 | 1 {
  return result === 'timed-out' ? 1 : 0;
}

export async function stopTelemetryBackend(
  server: TelemetryServer,
  app: TelemetryBackendShutdownTarget,
): Promise<'stopped' | 'timed-out'> {
  const result = await Promise.race([
    (async () => {
      await server.stop();
      await app.close();
      return 'stopped' as const;
    })(),
    shutdownTimeout(),
  ]);
  if (result === 'timed-out') {
    log.error({ event: 'shutdown-timeout', timeoutMs: SHUTDOWN_TIMEOUT_MS });
  }
  return result;
}

function createTelemetryBackendApp(config: TelemetryBackendConfig): TelemetryBackendApp {
  const db = createTelemetryDb(config.databaseUrl);
  const rateLimiter = createRequestsPerMinuteRateLimiter(config.requestsPerMinute);
  return {
    handler: createHandler({
      db,
      rateLimiter,
      trustForwardedFor: config.trustForwardedFor,
    }),
    requestsPerMinute: config.requestsPerMinute,
    close: () => db.runtime().close(),
  };
}

export function resolveTelemetryBackendConfig(
  env: Record<string, string | undefined> = process.env,
): TelemetryBackendConfig {
  const databaseUrl = env['DATABASE_URL'];
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error('DATABASE_URL must be set');
  }

  const port = parsePositiveIntegerFromEnv('PORT', env, '8080');
  const requestsPerMinute = parsePositiveIntegerFromEnv('RATE_LIMIT_RPM', env, '120');
  const trustForwardedFor = parseBooleanEnv('TRUST_FORWARDED_FOR', env, false);

  return { databaseUrl, port, requestsPerMinute, trustForwardedFor };
}

export async function runTelemetryBackendServer(
  startServer: StartTelemetryServer,
  env: Record<string, string | undefined> = process.env,
): Promise<void> {
  const config = resolveTelemetryBackendConfig(env);
  const app = createTelemetryBackendApp(config);
  let server: TelemetryServer;
  try {
    server = await startServer({ port: config.port, handler: app.handler });
  } catch (error) {
    await app.close();
    throw error;
  }

  log.info({
    event: 'startup',
    port: server.port,
    requestsPerMinute: app.requestsPerMinute,
  });

  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    log.info({ event: 'shutdown-requested', signal });

    let exitCode: 0 | 1 = 0;
    try {
      exitCode = shutdownExitCode(await stopTelemetryBackend(server, app));
    } catch (error) {
      exitCode = 1;
      log.error({
        event: 'shutdown-failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
    process.exit(exitCode);
  };

  process.on('SIGINT', (signal) => {
    void shutdown(signal);
  });
  process.on('SIGTERM', (signal) => {
    void shutdown(signal);
  });
}
