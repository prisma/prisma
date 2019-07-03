# Migration steps

> You can find the implementation of the migration steps [here](https://github.com/prisma/prisma/blob/alpha/server/prisma-rs/migration-engine/connectors/migration-connector/tests/steps_tests.rs) and learn more about their behaviour in the tests [here](https://github.com/prisma/prisma/blob/alpha/server/prisma-rs/migration-engine/connectors/migration-connector/tests/steps_tests.rs).

## Step types

### `CreateModel`

#### Properties

- `name` (string): The name of the new model.
- `embedded` (boolean): Specifies whether the model is an _embedded_ type.
- `db_name` (string, optional): TBD

#### Examples

##### Adding a new model

Assume the following model is added to the datamodel:

```groovy
model User {
  id: Int @id
  name: String?
}
```

This generates the following migration step of type `CreateModel`:

```json
{
  "stepType": "CreateModel",
  "name": "User",
  "embedded": false
}
```

> The generated steps of other step types are omitted for brevity.

### `UpdateModel`

### `DeleteModel`

### `CreateField`

### `UpdateField`

### `DeleteField`

### `CreateEnum`

### `UpdateEnum`

### `DeleteEnum`