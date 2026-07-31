# @internal/mongo-contract

Contract types and validation for the MongoDB family.

## Responsibilities

- **Contract types**: `MongoContract`, `MongoContractWithTypeMaps`, `MongoTypeMaps`, `MongoModelDefinition`, `MongoStorageShape` (raw-JSON storage shape) — the typed contract representation for MongoDB targets
- **Storage IR**: `MongoStorage` — the in-memory storage class instantiated by the per-target contract serializer; structurally satisfies `MongoStorageShape` and additionally carries the `namespaces` map
- **Type-level extraction**: `ExtractMongoTypeMaps`, `ExtractMongoCodecTypes`, `InferModelRow` — utility types for deriving codec types and row shapes from a contract
- **Structural schema + storage validation primitives**: `MongoContractSchema` (arktype envelope) and `validateMongoStorage()` — consumed by the family `ContractSerializerBase` to validate Mongo contracts at the deserializer seam. No freestanding `validateMongoContract` wrapper is exported; callers cross the seam via `familyInstance.deserializeContract(...)`.

## Dependencies

- **Depends on**:
  - `@internal/contract` (base `Contract`, `ContractModel`, `StorageBase` types and `validateContractDomain`)
  - `arktype` (runtime validation)
- **Depended on by**:
  - `@internal/mongo-orm` (contract-typed queries and row inference)
  - `@internal/mongo-emitter` (contract emission and validation)
  - `@internal/mongo-contract-psl` (PSL-to-contract interpretation)
  - `@internal/mongo-runtime` (contract-typed plan execution)
