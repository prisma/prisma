interface ClientEventSource {
  on(event: 'error' | 'end', listener: () => void): unknown;
}

const watchedClients = new WeakSet<ClientEventSource>();
const lostClients = new WeakSet<ClientEventSource>();

/**
 * Records when a pg client emits `error` or `end`. pg emits both before the failed query's
 * promise rejects, so a caller handling that rejection already sees the loss.
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

/** Whether a watched client has emitted `error` or `end`. */
export function hasLostConnection(client: ClientEventSource): boolean {
  return lostClients.has(client);
}

/**
 * Whether a pg `Client` has connected or begun connecting. pg exposes no public flag for this,
 * so it reads pg's own `_connected` and `_connecting` fields.
 */
export function hasStartedConnecting(client: object): boolean {
  return (
    ('_connected' in client && client._connected === true) ||
    ('_connecting' in client && client._connecting === true)
  );
}
