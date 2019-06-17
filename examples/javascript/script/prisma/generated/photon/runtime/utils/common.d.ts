import { DMMF } from '../dmmf-types';
export interface Dictionary<T> {
    [key: string]: T;
}
export declare const keyBy: <T>(collection: T[], iteratee: (value: T) => string) => Dictionary<T>;
export declare const ScalarTypeTable: {
    String: boolean;
    Int: boolean;
    Float: boolean;
    Boolean: boolean;
    Long: boolean;
    DateTime: boolean;
    ID: boolean;
    UUID: boolean;
    Json: boolean;
};
export declare function isScalar(str: string): boolean;
export declare const GraphQLScalarToJSTypeTable: {
    String: string;
    Int: string;
    Float: string;
    Boolean: string;
    Long: string;
    DateTime: string[];
    ID: string;
    UUID: string;
    Json: string;
};
export declare const JSTypeToGraphQLType: {
    string: string;
    boolean: string;
    object: string;
};
export declare function stringifyGraphQLType(type: string | DMMF.InputType | DMMF.Enum): string;
export declare function wrapWithList(str: string, isList: boolean): string;
export declare function getGraphQLType(value: any, potentialType?: string | DMMF.Enum | DMMF.InputType): string;
export declare function graphQLToJSType(gql: string): any;
export declare function getSuggestion(str: string, possibilities: string[]): string | null;
export declare function stringifyInputType(input: string | DMMF.InputType | DMMF.Enum, greenKeys?: boolean): string;
export declare function getInputTypeName(input: string | DMMF.InputType | DMMF.SchemaField | DMMF.Enum): string;
export declare function getOutputTypeName(input: string | DMMF.OutputType | DMMF.SchemaField | DMMF.Enum): string;
export declare function inputTypeToJson(input: string | DMMF.InputType | DMMF.Enum, isRequired: boolean, nameOnly?: boolean): string | object;
export declare function destroyCircular(from: any, seen?: any[]): any;
export declare function unionBy<T>(arr1: T[], arr2: T[], iteratee: (element: T) => string | number): T[];
export declare function uniqBy<T>(arr: T[], iteratee: (element: T) => string | number): T[];
export declare function capitalize(str: string): string;
/**
 * Converts the first character of a word to lower case
 * @param name
 */
export declare function lowerCase(name: string): string;
