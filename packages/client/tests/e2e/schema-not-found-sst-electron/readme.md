# Readme

Tests that we are compatible with some tooling (eg. `sst`, or `electron`) that
will bundle and move folders around. In simple words, we want to make sure that
if you generate in a project like this:

/project /a/b/c (output to your generated client)

We also want to make sure that you can bundle and move the generated client:

/project/dist /b/c (note how the client is one level up)
