# Readme

Regression test for https://github.com/prisma/prisma/issues/27074.

It tests that our generated code does not contain values from the users env vars through the `env(...)` placeholder in the schema file by accident.
