# Failed inferMigrationSteps
## RPC Input One Line
```json
{"id":1,"jsonrpc":"2.0","method":"inferMigrationSteps","params":{"projectInfo":"","datamodel":"model Blog {\n  id: Int @id\n  name: String\n  viewCount: Int\n  posts: Post[]\n  authors: Author[]\n}\n\nmodel Author {\n  id: Int @id\n  name: String?\n}         \n\nmodel Post {\n  id: Int @id\n  anotherString: String?\n}\n\nmodel Post4 {\n  id: Int @id\n  anotherString: String?\n}\n\nmodel Post5 {\n  id: Int @id\n  anotherString: String?\n}\n\nmodel Post6 {\n  id: Int @id\n  anotherString: String?\n}\n\nmodel Post100 {\n  id: Int @id\n  anotherString: String?\n}","migrationId":"watch-20190610183426","assumeToBeApplied":[]}}
```

## RPC Input Readable
```json
{
  "id": 1,
  "jsonrpc": "2.0",
  "method": "inferMigrationSteps",
  "params": {
    "projectInfo": "",
    "datamodel": "model Blog {\n  id: Int @id\n  name: String\n  viewCount: Int\n  posts: Post[]\n  authors: Author[]\n}\n\nmodel Author {\n  id: Int @id\n  name: String?\n}         \n\nmodel Post {\n  id: Int @id\n  anotherString: String?\n}\n\nmodel Post4 {\n  id: Int @id\n  anotherString: String?\n}\n\nmodel Post5 {\n  id: Int @id\n  anotherString: String?\n}\n\nmodel Post6 {\n  id: Int @id\n  anotherString: String?\n}\n\nmodel Post100 {\n  id: Int @id\n  anotherString: String?\n}",
    "migrationId": "watch-20190610183426",
    "assumeToBeApplied": []
  }
}
```


## RPC Response
```
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32602,
    "message": "Invalid params: unknown field `datamodel`, expected one of `projectInfo`, `migrationId`, `dataModel`, `assumeToBeApplied`."
  },
  "id": 1
}
```

## Stack Trace
```bash

```
