import { Dictionary } from './common';
export declare type ConnectorType = 'mysql' | 'mongo' | 'sqlite' | 'postgres';
export interface GeneratorConfig {
    name: string;
    output: string | null;
    provider: string;
    config: Dictionary<string>;
}
export declare type Datasource = string | {
    url: string;
    [key: string]: any | undefined;
};
export interface InternalDatasource {
    name: string;
    connectorType: ConnectorType;
    url: string;
    config: any;
}
export declare function printDatasources(dataSources: Dictionary<Datasource | undefined>, internalDatasources: InternalDatasource[]): string;
