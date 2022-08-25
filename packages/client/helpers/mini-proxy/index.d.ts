/// <reference types="node" />

import https from 'https';

export declare type CertificatesConfig = {
    caKey: string;
    caCert: string;
    key: string;
    cert: string;
    csr: string;
};

export declare type ConnectionStringConfig = {
    databaseUrl: string;
    envVar: string;
    port: number;
};

export declare function decodeKey(key: string): KeyContents;

export declare function decodeKeyOrNull(key: string): KeyContents | null;

export declare const defaultCertificatesConfig: CertificatesConfig;

export declare const defaultServerConfig: ServerConfig;

export declare function encodeKey(config: EncodeKeyConfig): string;

export declare type EncodeKeyConfig = {
    databaseUrl: string;
    envVar: string;
};

export declare function generateCertificates(config: CertificatesConfig): Promise<void>;

export declare function generateConnectionString(config: ConnectionStringConfig): string;

export declare type KeyContents = {
    url: string;
    envVar: string;
};

export declare type ServerConfig = {
    platform?: string;
    queryEngine?: string;
    port: number;
    ca?: string;
    key: string;
    cert: string;
};

export declare function startServer(config: ServerConfig): Promise<https.Server>;

export { }
