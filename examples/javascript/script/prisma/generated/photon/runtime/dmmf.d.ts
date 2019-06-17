import { DMMF } from './dmmf-types';
import { Dictionary } from './utils/common';
export declare class DMMFClass implements DMMF.Document {
    datamodel: DMMF.Datamodel;
    schema: DMMF.Schema;
    mappings: DMMF.Mapping[];
    queryType: DMMF.OutputType;
    mutationType: DMMF.OutputType;
    outputTypes: DMMF.OutputType[];
    outputTypeMap: Dictionary<DMMF.OutputType>;
    inputTypes: DMMF.InputType[];
    inputTypeMap: Dictionary<DMMF.InputType>;
    enumMap: Dictionary<DMMF.Enum>;
    modelMap: Dictionary<DMMF.Model>;
    constructor({ datamodel, schema, mappings }: DMMF.Document);
    getField(fieldName: string): DMMF.SchemaField;
    protected outputTypeToMergedOutputType: (outputType: DMMF.OutputType) => DMMF.OutputType;
    protected resolveOutputTypes(types: DMMF.OutputType[]): void;
    protected resolveInputTypes(types: DMMF.InputType[]): void;
    protected resolveFieldArgumentTypes(types: DMMF.OutputType[], inputTypeMap: Dictionary<DMMF.InputType>): void;
    protected getQueryType(): DMMF.OutputType;
    protected getMutationType(): DMMF.OutputType;
    protected getOutputTypes(): DMMF.OutputType[];
    protected getEnumMap(): Dictionary<DMMF.Enum>;
    protected getModelMap(): Dictionary<DMMF.Model>;
    protected getMergedOutputTypeMap(): Dictionary<DMMF.OutputType>;
    protected getInputTypeMap(): Dictionary<DMMF.InputType>;
}
