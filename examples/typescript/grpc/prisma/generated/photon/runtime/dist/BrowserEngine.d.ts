export declare type Fetcher = (input: {
    query: string;
    typeName?: string;
}) => Promise<{
    data?: any;
    error?: any;
    errors?: any;
}>;
interface EngineConfig {
    url?: string;
    fetcher?: Fetcher;
}
export declare class BrowserEngine {
    fetcher: Fetcher;
    url?: string;
    constructor({ fetcher }: EngineConfig);
    start(): Promise<void>;
    stop(): Promise<void>;
    defaultFetcher: ({ query, typeName }: {
        query: string;
        typeName?: string;
    }) => Promise<any>;
    request<T>(query: string, typeName?: string): Promise<T>;
    handleErrors({ errors, query }: {
        errors?: any;
        query: string;
    }): void;
}
export {};
