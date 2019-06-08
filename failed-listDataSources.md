# Failed listDataSources
## RPC Input One Line
```json
{"id":1,"jsonrpc":"2.0","method":"listDataSources","params":{"projectInfo":"","datamodel":"model User {\n  id String? @default(uuid()) @id @unique\n  name String\n}\n\nsource postgres \n  type = \"Postgres\"\n  url  = \"postgres://localhost:5432/prisma\"\n}"}}
```

## RPC Input Readable
```json
{
  "id": 1,
  "jsonrpc": "2.0",
  "method": "listDataSources",
  "params": {
    "projectInfo": "",
    "datamodel": "model User {\n  id String? @default(uuid()) @id @unique\n  name String\n}\n\nsource postgres \n  type = \"Postgres\"\n  url  = \"postgres://localhost:5432/prisma\"\n}"
  }
}
```


## RPC Response
```
{
  "jsonrpc": "2.0",
  "error": {
    "code": 4466,
    "message": "An error happened. Check the data field for details.",
    "data": {
      "type": "DataModelErrors",
      "code": 1000,
      "errors": [
        "Unexpected token. Expected one of: end of input, type declaration, model declaration, enum declaration, source definition."
      ]
    }
  },
  "id": 1
}
```

## Stack Trace
```bash
[migration-engine/connectors/sql-migration-connector/src/sql_migration_persistence.rs:33] m.make::<barrel::backend::Sqlite>() = "CREATE TABLE IF NOT EXISTS \"migration_engine\".\"_Migration\" (\"revision\" INTEGER NOT NULL PRIMARY KEY, \"name\" TEXT NOT NULL, \"datamodel\" TEXT NOT NULL, \"status\" TEXT NOT NULL, \"applied\" INTEGER NOT NULL, \"rolled_back\" INTEGER NOT NULL, \"datamodel_steps\" TEXT NOT NULL, \"database_migration\" TEXT NOT NULL, \"errors\" TEXT NOT NULL, \"started_at\" DATE NOT NULL, \"finished_at\" DATE);"
[libs/datamodel/src/ast/parser/mod.rs:384] positives = [
    EOI,
    type_declaration,
    model_declaration,
    enum_declaration,
    source_block
]

```
