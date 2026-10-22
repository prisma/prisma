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
