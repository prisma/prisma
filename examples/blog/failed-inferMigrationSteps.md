# Failed inferMigrationSteps at 2019-06-11T16:36:55.815Z
## RPC Input One Line
```json
{"id":1,"jsonrpc":"2.0","method":"inferMigrationSteps","params":{"projectInfo":"","sourceConfig":"datasource my_db {\n  provider = \"sqlite\"\n  url = \"file:./db/db_file.db\"\n  default = true\n}\n\nmodel Blog {\n  id Int @id\n  viewCount2 Int\n}\n\nmodel Post {\n  id Int @id\n  anotherString2 String?\n}\n\nmodel Post2 {\n  id Int @id\n  anotherString2 String?\n}","datamodel":"datasource my_db {\n  provider = \"sqlite\"\n  url = \"file:./db/db_file.db\"\n  default = true\n}\n\nmodel Blog {\n  id Int @id\n  viewCount2 Int\n}\n\nmodel Post {\n  id Int @id\n  anotherString2 String?\n}\n\nmodel Post2 {\n  id Int @id\n  anotherString2 String?\n}","migrationId":"DUMMY_NAME","assumeToBeApplied":[{"stepType":"CreateModel","name":"Post","embedded":false},{"stepType":"CreateField","model":"Post","name":"id","type":{"Base":"Int"},"arity":"required","isUnique":false,"id":{"strategy":"Auto","sequence":null}},{"stepType":"CreateField","model":"Post","name":"anotherString2","type":{"Base":"String"},"arity":"optional","isUnique":false}]}}
```

## RPC Input Readable
```json
{
  "id": 1,
  "jsonrpc": "2.0",
  "method": "inferMigrationSteps",
  "params": {
    "projectInfo": "",
    "sourceConfig": "datasource my_db {\n  provider = \"sqlite\"\n  url = \"file:./db/db_file.db\"\n  default = true\n}\n\nmodel Blog {\n  id Int @id\n  viewCount2 Int\n}\n\nmodel Post {\n  id Int @id\n  anotherString2 String?\n}\n\nmodel Post2 {\n  id Int @id\n  anotherString2 String?\n}",
    "datamodel": "datasource my_db {\n  provider = \"sqlite\"\n  url = \"file:./db/db_file.db\"\n  default = true\n}\n\nmodel Blog {\n  id Int @id\n  viewCount2 Int\n}\n\nmodel Post {\n  id Int @id\n  anotherString2 String?\n}\n\nmodel Post2 {\n  id Int @id\n  anotherString2 String?\n}",
    "migrationId": "DUMMY_NAME",
    "assumeToBeApplied": [
      {
        "stepType": "CreateModel",
        "name": "Post",
        "embedded": false
      },
      {
        "stepType": "CreateField",
        "model": "Post",
        "name": "id",
        "type": {
          "Base": "Int"
        },
        "arity": "required",
        "isUnique": false,
        "id": {
          "strategy": "Auto",
          "sequence": null
        }
      },
      {
        "stepType": "CreateField",
        "model": "Post",
        "name": "anotherString2",
        "type": {
          "Base": "String"
        },
        "arity": "optional",
        "isUnique": false
      }
    ]
  }
}
```


## RPC Response
```
null
```

## Stack Trace
```bash
[migration-engine/connectors/sql-migration-connector/src/sql_migration_persistence.rs:35] m.make::<barrel::backend::Sqlite>() = "CREATE TABLE IF NOT EXISTS \"db_file\".\"_Migration\" (\"revision\" INTEGER NOT NULL PRIMARY KEY, \"name\" TEXT NOT NULL, \"datamodel\" TEXT NOT NULL, \"status\" TEXT NOT NULL, \"applied\" INTEGER NOT NULL, \"rolled_back\" INTEGER NOT NULL, \"datamodel_steps\" TEXT NOT NULL, \"database_migration\" TEXT NOT NULL, \"errors\" TEXT NOT NULL, \"started_at\" DATE NOT NULL, \"finished_at\" DATE);"
[/var/root/.cargo/git/checkouts/prisma-query-a8c45647247f5d6d/4534840/src/connector/sqlite.rs:70] visitor::Sqlite::build(q) = (
    "SELECT `_Migration`.* FROM `_Migration` WHERE `status` = ? ORDER BY `revision` DESC",
    [
        Text(
            "Success"
        )
    ]
)
thread 'main' panicked at 'The model Post already exists in this Datamodel. It is not possible to create it once more.', migration-engine/core/src/migration/datamodel_calculator.rs:59:9
stack backtrace:
   0: std::sys::unix::backtrace::tracing::imp::unwind_backtrace
   1: std::sys_common::backtrace::_print
   2: std::panicking::default_hook::{{closure}}
   3: std::panicking::default_hook
   4: std::panicking::rust_panic_with_hook
   5: std::panicking::continue_panic_fmt
   6: std::panicking::begin_panic_fmt
   7: <migration_core::migration::datamodel_calculator::DataModelCalculatorImpl as migration_core::migration::datamodel_calculator::DataModelCalculator>::infer
   8: <migration_core::commands::infer_migration_steps::InferMigrationStepsCommand as migration_core::commands::command::MigrationCommand>::execute
   9: <F as jsonrpc_core::calls::RpcMethodSimple>::call
  10: <F as jsonrpc_core::calls::RpcMethod<T>>::call
  11: <futures::future::lazy::Lazy<F, R> as futures::future::Future>::poll
  12: <futures::future::chain::Chain<A, B, C>>::poll
  13: <futures::future::then::Then<A, B, F> as futures::future::Future>::poll
  14: <futures::future::map::Map<A, F> as futures::future::Future>::poll
  15: <futures::future::either::Either<A, B> as futures::future::Future>::poll
  16: futures::task_impl::std::set
  17: futures::task_impl::std::ThreadNotify::with_current
  18: futures::future::Future::wait
  19: <jsonrpc_core::io::IoHandler<M>>::handle_request_sync
  20: migration_core::rpc_api::RpcApi::handle
  21: migration_engine::main
  22: std::rt::lang_start::{{closure}}
  23: std::panicking::try::do_call
  24: __rust_maybe_catch_panic
  25: std::rt::lang_start_internal
  26: main

```
