/// <reference types="node" />
/**
 * Process class
 */
export default class Process {
    private readonly name;
    private readonly args;
    private _cwd;
    private _env;
    private _process?;
    private _running?;
    private _stderr?;
    private _stdout?;
    /**
     * Create a process
     */
    constructor(name: string, ...args: string[]);
    /**
     * Get the process ID if we have one
     */
    pid(): number;
    /**
     * Running?
     */
    running(): boolean;
    /**
     * Set the working directory
     */
    cwd(dir: string): void;
    /**
     * Set the working directory
     */
    env(env: NodeJS.ProcessEnv): void;
    /**
     * Set stderr
     */
    stderr(writer: NodeJS.WritableStream): void;
    /**
     * Set stdout
     */
    stdout(writer: NodeJS.WritableStream): void;
    /**
     * Start the process but don't wait for it to finish
     *
     * @todo right now we never will receive an error
     * in the future we should check to see if we had
     * an error immediately, using Promise.race([tick, deferred])
     */
    start(): Promise<void>;
    /**
     * Wait until the process exits or errors out
     */
    wait(): Promise<void>;
    /**
     * Run starts the process and waits for the result
     */
    run(): Promise<void>;
    /**
     * Send a signal
     */
    signal(signal: NodeJS.Signals): Promise<void>;
    /**
     * Kill and wait for the process to exit
     */
    kill(): Promise<void>;
}
