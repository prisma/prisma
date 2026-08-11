/**
 * Closes a control client without letting the close itself become the run's
 * outcome. A rejection here would replace the structured error a `catch` has
 * already produced, which is how a connection failure ends up reported as a
 * teardown failure.
 */
export async function closeQuietly(client: { readonly close: () => Promise<void> }): Promise<void> {
  await client.close().catch(() => undefined);
}
