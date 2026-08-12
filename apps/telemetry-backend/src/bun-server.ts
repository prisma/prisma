import { log } from './logger';
import type { TelemetryServer, TelemetryServerStartOptions } from './server-runtime';

export function startBunTelemetryServer(options: TelemetryServerStartOptions): TelemetryServer {
  const server = Bun.serve({
    port: options.port,
    async fetch(request, srv): Promise<Response> {
      const remoteAddress = srv.requestIP(request)?.address ?? undefined;
      return options.handler(request, remoteAddress !== undefined ? { remoteAddress } : undefined);
    },
    error(error): Response {
      log.error({
        event: 'request-internal-error',
        error: error instanceof Error ? error.message : String(error),
      });
      return new Response('Internal Server Error', { status: 500 });
    },
  });

  return {
    port: server.port ?? options.port,
    stop() {
      server.stop();
    },
  };
}
