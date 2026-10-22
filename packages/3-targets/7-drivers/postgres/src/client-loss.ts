import { normalizePgConnectionError } from './normalize-error';

interface ClientEventSource {
  on(event: 'error' | 'end', listener: () => void): unknown;
}

const watchedClients = new WeakSet<ClientEventSource>();
const lostClients = new WeakSet<ClientEventSource>();

/**
 * Records when a pg client emits `error` or `end`. pg emits both before the failed query's
 * promise rejects, so {@link classifyClientError} sees the loss when it handles that rejection.
 */
export function watchClientLoss<T extends ClientEventSource>(client: T): T {
  if (!watchedClients.has(client)) {
    watchedClients.add(client);
    const markLost = () => lostClients.add(client);
    client.on('error', markLost);
    client.on('end', markLost);
  }
  return client;
}

export function hasLostConnection(client: ClientEventSource): boolean {
  return lostClients.has(client);
}

/**
 * pg raises the failures of a dead connection ("Connection terminated", "not queryable") as
 * errors with no code. Once the client has emitted `error` or `end`, an error from it is a
 * connection error; otherwise the error is returned unchanged.
 */
export function classifyClientError(client: ClientEventSource, error: unknown): unknown {
  return hasLostConnection(client) ? normalizePgConnectionError(error) : error;
}
