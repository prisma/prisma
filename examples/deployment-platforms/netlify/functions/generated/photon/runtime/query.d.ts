import 'flat-map-polyfill';
import { /*dmmf, */ DMMFClass } from './dmmf';
import { DMMF } from './dmmf-types';
import { ArgError, FieldError, InvalidArgError, InvalidFieldError } from './error-types';
export declare class Document {
    readonly type: 'query' | 'mutation';
    readonly children: Field[];
    constructor(type: 'query' | 'mutation', children: Field[]);
    toString(): string;
    validate(select: any, isTopLevelQuery?: boolean, originalMethod?: string): void;
    protected printFieldError: ({ error, path }: FieldError) => string;
    protected printArgError: ({ error, path }: ArgError, hasMissingItems: boolean) => string;
    /**
     * As we're allowing both single objects and array of objects for list inputs, we need to remove incorrect
     * zero indexes from the path
     * @param inputPath e.g. ['where', 'AND', 0, 'id']
     * @param select select object
     */
    private normalizePath;
}
export interface FieldArgs {
    name: string;
    args?: Args;
    children?: Field[];
    error?: InvalidFieldError;
}
export declare class Field {
    readonly name: string;
    readonly args?: Args;
    readonly children?: Field[];
    readonly error?: InvalidFieldError;
    readonly hasInvalidChild: boolean;
    readonly hasInvalidArg: boolean;
    constructor({ name, args, children, error }: FieldArgs);
    toString(): string;
    collectErrors(prefix?: string): {
        fieldErrors: FieldError[];
        argErrors: ArgError[];
    };
}
export declare class Args {
    readonly args: Arg[];
    readonly hasInvalidArg: boolean;
    constructor(args?: Arg[]);
    toString(): string;
    collectErrors(): ArgError[];
}
interface ArgOptions {
    key: string;
    value: ArgValue;
    argType?: DMMF.ArgType;
    isEnum?: boolean;
    error?: InvalidArgError;
    schemaArg?: DMMF.SchemaArg;
}
export declare class Arg {
    readonly key: string;
    readonly value: ArgValue;
    readonly error?: InvalidArgError;
    readonly hasError: boolean;
    readonly isEnum: boolean;
    readonly schemaArg?: DMMF.SchemaArg;
    readonly argType?: DMMF.ArgType;
    constructor({ key, value, argType, isEnum, error, schemaArg }: ArgOptions);
    _toString(value: ArgValue, key: string): string | undefined;
    toString(): string;
    collectErrors(): ArgError[];
}
export declare type ArgValue = string | boolean | number | undefined | Args | string[] | boolean[] | number[] | Args[];
export interface DocumentInput {
    dmmf: DMMFClass;
    rootTypeName: 'query' | 'mutation';
    rootField: string;
    select: any;
}
export declare function makeDocument({ dmmf, rootTypeName, rootField, select }: DocumentInput): Document;
export declare function transformDocument(document: Document): Document;
export declare function selectionToFields(dmmf: DMMFClass, selection: any, schemaField: DMMF.SchemaField, path: string[]): Field[];
export declare function isInputArgType(argType: DMMF.ArgType): argType is DMMF.InputType;
export {};
