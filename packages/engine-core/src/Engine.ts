export class PhotonError extends Error {
  constructor(
    public readonly message: string,
    public readonly query?: string,
    public readonly error?: any,
    public readonly logs?: string,
    public readonly isPanicked?: boolean,
  ) {
    super(message)
  }
}

/**
 * Engine Base Class used by Browser and Node.js
 */
export abstract class Engine {
  /**
   * Starts the engine
   */
  abstract start(): Promise<void>

  /**
   * If Prisma runs, stop it
   */
  abstract stop(): void

  abstract request<T>(query: string): Promise<T>

  abstract handleErrors({ errors, query }: { errors?: any; query: string }): void
}
