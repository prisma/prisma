import { startBunTelemetryServer } from './bun-server';
import { runTelemetryBackendServer } from './server-runtime';

await runTelemetryBackendServer(startBunTelemetryServer);
