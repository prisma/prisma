import { Engine } from './Engine';
import Process from './process';
import Deferred from 'deferral';
interface EngineConfig {
    cwd?: string;
    datamodel: string;
    debug?: boolean;
    prismaPath?: string;
    fetcher?: (query: string) => Promise<{
        data?: any;
        error?: any;
    }>;
}
/**
 * Node.js based wrapper to run the Prisma binary
 */
export declare class NodeEngine extends Engine {
    port?: number;
    debug: boolean;
    child?: Process;
    /**
     * exiting is used to tell the .on('exit') hook, if the exit came from our script.
     * As soon as the Prisma binary returns a correct return code (like 1 or 0), we don't need this anymore
     */
    exiting: boolean;
    managementApiEnabled: boolean;
    datamodelJson?: string;
    cwd: string;
    datamodel: string;
    prismaPath: string;
    url: string;
    starting?: Deferred<void>;
    stderrLogs: string;
    stdoutLogs: string;
    currentRequestPromise?: Promise<any>;
    static defaultPrismaPath: string;
    constructor({ cwd, datamodel, prismaPath, ...args }: EngineConfig);
    /**
     * Starts the engine, returns the url that it runs on
     */
    start(): Promise<void>;
    fail: (e: any, why: any) => Promise<void>;
    /**
     * If Prisma runs, stop it
     */
    stop(): Promise<void>;
    /**
     * Use the port 0 trick to get a new port
     */
    protected getFreePort(): Promise<number>;
    /**
     * Make sure that our internal port is not conflicting with the prisma.yml's port
     * @param str config
     */
    protected trimPort(str: string): string;
    protected engineReady(): Promise<void>;
    getDmmf(): Promise<any>;
    request<T>(query: string, typeName?: string): Promise<T>;
    handleErrors({ errors, query }: {
        errors?: any;
        query: string;
    }): void;
}
export {};
