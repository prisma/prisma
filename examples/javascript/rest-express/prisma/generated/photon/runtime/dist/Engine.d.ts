export declare class PhotonError extends Error {
    readonly message: string;
    readonly query?: string;
    readonly error?: any;
    readonly logs?: string;
    readonly isPanicked?: boolean;
    constructor(message: string, query?: string, error?: any, logs?: string, isPanicked?: boolean);
}
/**
 * Engine Base Class used by Browser and Node.js
 */
export declare abstract class Engine {
    /**
     * Starts the engine
     */
    abstract start(): Promise<void>;
    /**
     * If Prisma runs, stop it
     */
    abstract stop(): void;
    abstract request<T>(query: string, typeName?: string): Promise<T>;
    abstract handleErrors({ errors, query }: {
        errors?: any;
        query: string;
    }): void;
}
