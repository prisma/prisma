# Failed applyMigration
## RPC Input One Line
```json
{"id":1,"jsonrpc":"2.0","method":"applyMigration","params":{"projectInfo":"","force":false,"migrationId":"20190610184504","steps":[{"stepType":"CreateModel","name":"Blog","embedded":false},{"stepType":"CreateModel","name":"Author","embedded":false},{"stepType":"CreateModel","name":"Post","embedded":false},{"stepType":"CreateModel","name":"Post4","embedded":false},{"stepType":"CreateModel","name":"Post5","embedded":false},{"stepType":"CreateModel","name":"Post6","embedded":false},{"stepType":"CreateModel","name":"Post100","embedded":false},{"stepType":"CreateField","model":"Blog","name":"id","type":{"Base":"Int"},"arity":"required","isUnique":false,"id":{"strategy":"Auto","sequence":null}},{"stepType":"CreateField","model":"Blog","name":"name","type":{"Base":"String"},"arity":"required","isUnique":false},{"stepType":"CreateField","model":"Blog","name":"viewCount","type":{"Base":"Int"},"arity":"required","isUnique":false},{"stepType":"CreateField","model":"Blog","name":"posts","type":{"Relation":{"to":"Post","to_fields":[],"name":"BlogToPost","on_delete":"None"}},"arity":"list","isUnique":false},{"stepType":"CreateField","model":"Blog","name":"authors","type":{"Relation":{"to":"Author","to_fields":[],"name":"AuthorToBlog","on_delete":"None"}},"arity":"list","isUnique":false},{"stepType":"CreateField","model":"Author","name":"id","type":{"Base":"Int"},"arity":"required","isUnique":false,"id":{"strategy":"Auto","sequence":null}},{"stepType":"CreateField","model":"Author","name":"name","type":{"Base":"String"},"arity":"optional","isUnique":false},{"stepType":"CreateField","model":"Author","name":"blog","type":{"Relation":{"to":"Blog","to_fields":["id"],"name":"AuthorToBlog","on_delete":"None"}},"arity":"optional","isUnique":false},{"stepType":"CreateField","model":"Post","name":"id","type":{"Base":"Int"},"arity":"required","isUnique":false,"id":{"strategy":"Auto","sequence":null}},{"stepType":"CreateField","model":"Post","name":"anotherString","type":{"Base":"String"},"arity":"optional","isUnique":false},{"stepType":"CreateField","model":"Post","name":"blog","type":{"Relation":{"to":"Blog","to_fields":["id"],"name":"BlogToPost","on_delete":"None"}},"arity":"optional","isUnique":false},{"stepType":"CreateField","model":"Post4","name":"id","type":{"Base":"Int"},"arity":"required","isUnique":false,"id":{"strategy":"Auto","sequence":null}},{"stepType":"CreateField","model":"Post4","name":"anotherString","type":{"Base":"String"},"arity":"optional","isUnique":false},{"stepType":"CreateField","model":"Post5","name":"id","type":{"Base":"Int"},"arity":"required","isUnique":false,"id":{"strategy":"Auto","sequence":null}},{"stepType":"CreateField","model":"Post5","name":"anotherString","type":{"Base":"String"},"arity":"optional","isUnique":false},{"stepType":"CreateField","model":"Post6","name":"id","type":{"Base":"Int"},"arity":"required","isUnique":false,"id":{"strategy":"Auto","sequence":null}},{"stepType":"CreateField","model":"Post6","name":"anotherString","type":{"Base":"String"},"arity":"optional","isUnique":false},{"stepType":"CreateField","model":"Post100","name":"id","type":{"Base":"Int"},"arity":"required","isUnique":false,"id":{"strategy":"Auto","sequence":null}},{"stepType":"CreateField","model":"Post100","name":"anotherString","type":{"Base":"String"},"arity":"optional","isUnique":false},{"stepType":"DeleteModel","name":"Post4"},{"stepType":"DeleteModel","name":"Post5"},{"stepType":"DeleteModel","name":"Post6"},{"stepType":"DeleteModel","name":"Post100"},{"stepType":"CreateField","model":"Blog","name":"name2","type":{"Base":"String"},"arity":"required","isUnique":false},{"stepType":"DeleteField","model":"Blog","name":"name"}]}}
```

## RPC Input Readable
```json
{
  "id": 1,
  "jsonrpc": "2.0",
  "method": "applyMigration",
  "params": {
    "projectInfo": "",
    "force": false,
    "migrationId": "20190610184504",
    "steps": [
      {
        "stepType": "CreateModel",
        "name": "Blog",
        "embedded": false
      },
      {
        "stepType": "CreateModel",
        "name": "Author",
        "embedded": false
      },
      {
        "stepType": "CreateModel",
        "name": "Post",
        "embedded": false
      },
      {
        "stepType": "CreateModel",
        "name": "Post4",
        "embedded": false
      },
      {
        "stepType": "CreateModel",
        "name": "Post5",
        "embedded": false
      },
      {
        "stepType": "CreateModel",
        "name": "Post6",
        "embedded": false
      },
      {
        "stepType": "CreateModel",
        "name": "Post100",
        "embedded": false
      },
      {
        "stepType": "CreateField",
        "model": "Blog",
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
        "model": "Blog",
        "name": "name",
        "type": {
          "Base": "String"
        },
        "arity": "required",
        "isUnique": false
      },
      {
        "stepType": "CreateField",
        "model": "Blog",
        "name": "viewCount",
        "type": {
          "Base": "Int"
        },
        "arity": "required",
        "isUnique": false
      },
      {
        "stepType": "CreateField",
        "model": "Blog",
        "name": "posts",
        "type": {
          "Relation": {
            "to": "Post",
            "to_fields": [],
            "name": "BlogToPost",
            "on_delete": "None"
          }
        },
        "arity": "list",
        "isUnique": false
      },
      {
        "stepType": "CreateField",
        "model": "Blog",
        "name": "authors",
        "type": {
          "Relation": {
            "to": "Author",
            "to_fields": [],
            "name": "AuthorToBlog",
            "on_delete": "None"
          }
        },
        "arity": "list",
        "isUnique": false
      },
      {
        "stepType": "CreateField",
        "model": "Author",
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
        "model": "Author",
        "name": "name",
        "type": {
          "Base": "String"
        },
        "arity": "optional",
        "isUnique": false
      },
      {
        "stepType": "CreateField",
        "model": "Author",
        "name": "blog",
        "type": {
          "Relation": {
            "to": "Blog",
            "to_fields": [
              "id"
            ],
            "name": "AuthorToBlog",
            "on_delete": "None"
          }
        },
        "arity": "optional",
        "isUnique": false
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
        "name": "anotherString",
        "type": {
          "Base": "String"
        },
        "arity": "optional",
        "isUnique": false
      },
      {
        "stepType": "CreateField",
        "model": "Post",
        "name": "blog",
        "type": {
          "Relation": {
            "to": "Blog",
            "to_fields": [
              "id"
            ],
            "name": "BlogToPost",
            "on_delete": "None"
          }
        },
        "arity": "optional",
        "isUnique": false
      },
      {
        "stepType": "CreateField",
        "model": "Post4",
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
        "model": "Post4",
        "name": "anotherString",
        "type": {
          "Base": "String"
        },
        "arity": "optional",
        "isUnique": false
      },
      {
        "stepType": "CreateField",
        "model": "Post5",
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
        "model": "Post5",
        "name": "anotherString",
        "type": {
          "Base": "String"
        },
        "arity": "optional",
        "isUnique": false
      },
      {
        "stepType": "CreateField",
        "model": "Post6",
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
        "model": "Post6",
        "name": "anotherString",
        "type": {
          "Base": "String"
        },
        "arity": "optional",
        "isUnique": false
      },
      {
        "stepType": "CreateField",
        "model": "Post100",
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
        "model": "Post100",
        "name": "anotherString",
        "type": {
          "Base": "String"
        },
        "arity": "optional",
        "isUnique": false
      },
      {
        "stepType": "DeleteModel",
        "name": "Post4"
      },
      {
        "stepType": "DeleteModel",
        "name": "Post5"
      },
      {
        "stepType": "DeleteModel",
        "name": "Post6"
      },
      {
        "stepType": "DeleteModel",
        "name": "Post100"
      },
      {
        "stepType": "CreateField",
        "model": "Blog",
        "name": "name2",
        "type": {
          "Base": "String"
        },
        "arity": "required",
        "isUnique": false
      },
      {
        "stepType": "DeleteField",
        "model": "Blog",
        "name": "name"
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
[migration-engine/connectors/sql-migration-connector/src/sql_migration_persistence.rs:33] m.make::<barrel::backend::Sqlite>() = "CREATE TABLE IF NOT EXISTS \"migration_engine\".\"_Migration\" (\"revision\" INTEGER NOT NULL PRIMARY KEY, \"name\" TEXT NOT NULL, \"datamodel\" TEXT NOT NULL, \"status\" TEXT NOT NULL, \"applied\" INTEGER NOT NULL, \"rolled_back\" INTEGER NOT NULL, \"datamodel_steps\" TEXT NOT NULL, \"database_migration\" TEXT NOT NULL, \"errors\" TEXT NOT NULL, \"started_at\" DATE NOT NULL, \"finished_at\" DATE);"
[/Users/marcusboehm/.cargo/git/checkouts/prisma-query-a8c45647247f5d6d/8ea8214/src/connector/sqlite.rs:70] visitor::Sqlite::build(q) = (
    "SELECT `_Migration`.* FROM `_Migration` WHERE `status` = ? ORDER BY `revision` DESC",
    [
        Text(
            "Success"
        )
    ]
)
[/Users/marcusboehm/.cargo/git/checkouts/prisma-query-a8c45647247f5d6d/8ea8214/src/connector/sqlite.rs:70] visitor::Sqlite::build(q) = (
    "SELECT `_Migration`.* FROM `_Migration` WHERE `status` = ? ORDER BY `revision` DESC",
    [
        Text(
            "Success"
        )
    ]
)
thread 'main' panicked at 'The model Blog already exists in this Datamodel. It is not possible to create it once more.', migration-engine/core/src/migration/datamodel_calculator.rs:59:9
stack backtrace:
   0: std::sys::unix::backtrace::tracing::imp::unwind_backtrace
   1: std::sys_common::backtrace::_print
   2: std::panicking::default_hook::{{closure}}
   3: std::panicking::default_hook
   4: std::panicking::rust_panic_with_hook
   5: std::panicking::continue_panic_fmt
   6: std::panicking::begin_panic_fmt
   7: migration_core::migration::datamodel_calculator::apply_create_model
   8: <migration_core::migration::datamodel_calculator::DataModelCalculatorImpl as migration_core::migration::datamodel_calculator::DataModelCalculator>::infer::{{closure}}
   9: core::iter::traits::iterator::Iterator::for_each::{{closure}}
  10: <core::slice::Iter<'a, T> as core::iter::traits::iterator::Iterator>::fold
  11: core::iter::traits::iterator::Iterator::for_each
  12: <migration_core::migration::datamodel_calculator::DataModelCalculatorImpl as migration_core::migration::datamodel_calculator::DataModelCalculator>::infer
  13: migration_core::commands::apply_migration::ApplyMigrationCommand::handle_normal_migration
  14: <migration_core::commands::apply_migration::ApplyMigrationCommand as migration_core::commands::command::MigrationCommand>::execute
  15: migration_core::rpc_api::RpcApi::add_command_handler::{{closure}}
  16: <F as jsonrpc_core::calls::RpcMethodSimple>::call
  17: <jsonrpc_core::io::MetaIoHandler<T, S>>::add_method::{{closure}}
  18: <F as jsonrpc_core::calls::RpcMethod<T>>::call
  19: <jsonrpc_core::io::MetaIoHandler<T, S>>::handle_call::{{closure}}::{{closure}}::{{closure}}
  20: <futures::future::lazy::Lazy<F, R>>::get
  21: <futures::future::lazy::Lazy<F, R> as futures::future::Future>::poll
  22: <futures::future::chain::Chain<A, B, C>>::poll
  23: <futures::future::then::Then<A, B, F> as futures::future::Future>::poll
  24: <alloc::boxed::Box<F> as futures::future::Future>::poll
  25: <futures::future::either::Either<A, B> as futures::future::Future>::poll
  26: <futures::future::either::Either<A, B> as futures::future::Future>::poll
  27: <futures::future::map::Map<A, F> as futures::future::Future>::poll
  28: <futures::future::either::Either<A, B> as futures::future::Future>::poll
  29: <futures::future::either::Either<A, B> as futures::future::Future>::poll
  30: <futures::future::either::Either<A, B> as futures::future::Future>::poll
  31: <futures::future::map::Map<A, F> as futures::future::Future>::poll
  32: <futures::task_impl::Spawn<T>>::poll_future_notify::{{closure}}
  33: <futures::task_impl::Spawn<T>>::enter::{{closure}}
  34: futures::task_impl::std::set
  35: <futures::task_impl::Spawn<T>>::enter
  36: <futures::task_impl::Spawn<T>>::poll_fn_notify
  37: <futures::task_impl::Spawn<T>>::poll_future_notify
  38: futures::task_impl::std::<impl futures::task_impl::Spawn<F>>::wait_future::{{closure}}
  39: futures::task_impl::std::ThreadNotify::with_current::{{closure}}
  40: <std::thread::local::LocalKey<T>>::try_with
  41: <std::thread::local::LocalKey<T>>::with
  42: futures::task_impl::std::ThreadNotify::with_current
  43: futures::task_impl::std::<impl futures::task_impl::Spawn<F>>::wait_future
  44: futures::future::Future::wait
  45: <jsonrpc_core::io::MetaIoHandler<T, S>>::handle_request_sync
  46: <jsonrpc_core::io::IoHandler<M>>::handle_request_sync
  47: migration_core::rpc_api::RpcApi::handle_input
  48: migration_core::rpc_api::RpcApi::handle
  49: migration_engine::main
  50: std::rt::lang_start::{{closure}}
  51: std::panicking::try::do_call
  52: __rust_maybe_catch_panic
  53: std::rt::lang_start_internal
  54: std::rt::lang_start
  55: main

```
