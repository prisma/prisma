# Readme

This tests ensures that custom output clients are working as expected with Yarn.

A `package.json` is invalid for `yarn` if:

- It is not a valid json file
- It does not have a `name` field
- It does not have a `version` field
- The `name` field has invalid characters
- The `version` field has invalid characters
