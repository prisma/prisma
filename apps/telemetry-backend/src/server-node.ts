import { startNodeTelemetryServer } from './node-server';
import { runTelemetryBackendServer } from './server-runtime';

await runTelemetryBackendServer(startNodeTelemetryServer);
