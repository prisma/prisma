interface EmitsConnectionErrors {
  on(event: 'error', listener: (err: Error) => void): unknown;
}

/**
 * pg emits 'error' on a Pool or Client when an idle connection drops
 * (database restart, pooler timeout, network blip). With no listener Node
 * treats that as an uncaught exception and kills the process. pg already
 * discards the dead connection and hands the next query a fresh one, so
 * there is nothing left for the handler to do. Errors during connect or a
 * query still reject their own promises and are not masked.
 */
export function suppressIdleConnectionErrors<T extends EmitsConnectionErrors>(target: T): T {
  target.on('error', () => {});
  return target;
}
