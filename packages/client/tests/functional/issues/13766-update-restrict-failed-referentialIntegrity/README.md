## relationMode = prisma with onUpdate = Restrict

We test 2 different schemas

- `primary-key` where the id referenced in the relation is the Primary Key, we run the tests on all databases (except on MongoDB we only run 1 test, as the second test would need to mutate the primary key `_id`, which is immutable).
- `at-unique` where the id referenced in the relation is NOT the Primary Key, it is an `@unique` field, we run the tests on all databases.
