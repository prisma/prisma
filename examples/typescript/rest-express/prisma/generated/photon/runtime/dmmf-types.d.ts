export declare namespace ExternalDMMF {
    interface Document {
        datamodel: Datamodel;
        schema: Schema;
        mappings: Mapping[];
    }
    interface Enum {
        name: string;
        values: string[];
        dbName?: string | null;
    }
    interface Datamodel {
        models: Model[];
        enums: Enum[];
    }
    interface Model {
        name: string;
        isEmbedded: boolean;
        dbName: string | null;
        fields: Field[];
    }
    type FieldKind = 'scalar' | 'object' | 'enum';
    type DatamodelFieldKind = 'scalar' | 'relation' | 'enum';
    interface Field {
        kind: DatamodelFieldKind;
        name: string;
        isRequired: boolean;
        isList: boolean;
        isUnique: boolean;
        isId: boolean;
        type: string;
        dbName: string | null;
        isGenerated: boolean;
        relationToFields?: any[];
        relationOnDelete?: string;
        relationName?: string;
    }
    interface Schema {
        rootQueryType?: string;
        rootMutationType?: string;
        inputTypes: InputType[];
        outputTypes: OutputType[];
        enums: Enum[];
    }
    interface QueryOutput {
        name: string;
        isRequired: boolean;
        isList: boolean;
    }
    type ArgType = string;
    interface SchemaArg {
        name: string;
        inputType: {
            isRequired: boolean;
            isList: boolean;
            type: ArgType;
            kind: FieldKind;
        };
        isRelationFilter?: boolean;
    }
    interface OutputType {
        name: string;
        fields: SchemaField[];
        isEmbedded?: boolean;
    }
    interface SchemaField {
        name: string;
        outputType: {
            type: string;
            isList: boolean;
            isRequired: boolean;
            kind: FieldKind;
        };
        args: SchemaArg[];
    }
    interface InputType {
        name: string;
        isWhereType?: boolean;
        isOrderType?: boolean;
        atLeastOne?: boolean;
        atMostOne?: boolean;
        fields: SchemaArg[];
    }
    interface Mapping {
        model: string;
        findOne?: string;
        findMany?: string;
        create?: string;
        update?: string;
        updateMany?: string;
        upsert?: string;
        delete?: string;
        deleteMany?: string;
    }
    enum ModelAction {
        findOne = "findOne",
        findMany = "findMany",
        create = "create",
        update = "update",
        updateMany = "updateMany",
        upsert = "upsert",
        delete = "delete",
        deleteMany = "deleteMany"
    }
}
export declare namespace DMMF {
    interface Document {
        datamodel: Datamodel;
        schema: Schema;
        mappings: Mapping[];
    }
    interface Enum {
        name: string;
        values: string[];
        dbName?: string | null;
    }
    interface Datamodel {
        models: Model[];
        enums: Enum[];
    }
    interface Model {
        name: string;
        isEmbedded: boolean;
        dbName: string | null;
        fields: Field[];
        [key: string]: any;
    }
    type FieldKind = 'scalar' | 'object' | 'enum';
    interface Field {
        kind: FieldKind;
        name: string;
        isRequired: boolean;
        isList: boolean;
        isUnique: boolean;
        isId: boolean;
        type: string;
        dbName: string | null;
        isGenerated: boolean;
        relationToFields?: any[];
        relationOnDelete?: string;
        relationName?: string;
        [key: string]: any;
    }
    interface Schema {
        rootQueryType?: string;
        rootMutationType?: string;
        inputTypes: InputType[];
        outputTypes: OutputType[];
        enums: Enum[];
    }
    interface Query {
        name: string;
        args: SchemaArg[];
        output: QueryOutput;
    }
    interface QueryOutput {
        name: string;
        isRequired: boolean;
        isList: boolean;
    }
    type ArgType = string | InputType | Enum;
    interface SchemaArgInputType {
        isRequired: boolean;
        isList: boolean;
        type: ArgType;
        kind: FieldKind;
    }
    interface SchemaArg {
        name: string;
        inputType: SchemaArgInputType[];
        isRelationFilter?: boolean;
    }
    interface OutputType {
        name: string;
        fields: SchemaField[];
        isEmbedded?: boolean;
    }
    interface SchemaField {
        name: string;
        outputType: {
            type: string | OutputType | Enum;
            isList: boolean;
            isRequired: boolean;
            kind: FieldKind;
        };
        args: SchemaArg[];
    }
    interface InputType {
        name: string;
        isWhereType?: boolean;
        isOrderType?: boolean;
        atLeastOne?: boolean;
        atMostOne?: boolean;
        fields: SchemaArg[];
    }
    interface Mapping {
        model: string;
        plural: string;
        findOne?: string | null;
        findMany?: string | null;
        create?: string | null;
        update?: string | null;
        updateMany?: string | null;
        upsert?: string | null;
        delete?: string | null;
        deleteMany?: string | null;
    }
    enum ModelAction {
        findOne = "findOne",
        findMany = "findMany",
        create = "create",
        update = "update",
        updateMany = "updateMany",
        upsert = "upsert",
        delete = "delete",
        deleteMany = "deleteMany"
    }
}
export interface BaseField {
    name: string;
    type: string | DMMF.Enum | DMMF.OutputType | DMMF.SchemaArg;
    isList: boolean;
    isRequired: boolean;
}
