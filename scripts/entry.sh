#!/bin/bash

set -ex

# NO_PUBLISH comes from a pipeline trigger and not from an ordinary push
# in this case we only want to test
if [[ $NO_PUBLISH ]]; then
  buildkite-agent pipeline upload .buildkite/test.yml
  exit 0
fi

if [[ $BUILDKITE_COMMIT ]]; then
  export LAST_COMMIT=$BUILDKITE_COMMIT
else
  export LAST_COMMIT=$(git merge-base --fork-point HEAD)
fi

export CLI_CHANGED_COUNT=$(git diff-tree --no-commit-id --name-only -r $LAST_COMMIT cli | wc -l)

# did anytying in ./cli change?
if [ $CLI_CHANGED_COUNT -gt 0 ]; then
  export CLI_CHANGED=true
fi

# did anytying in ./prisma2 change?
export PRISMA2_CHANGED_COUNT=$(git diff-tree --no-commit-id --name-only -r $LAST_COMMIT prisma2 | wc -l)
if [ $PRISMA2_CHANGED_COUNT -gt 0 ]; then
  export PRISMA2_CHANGED=true
fi

# did anytying in ./introspection change?
export INTROSPECTION_CHANGED_COUNT=$(git diff-tree --no-commit-id --name-only -r $LAST_COMMIT introspection | wc -l)
if [ $INTROSPECTION_CHANGED_COUNT -gt 0 ]; then
  export INTROSPECTION_CHANGED=true
fi

if [ -z "$CLI_CHANGED" ] && [ -z "$PRISMA2_CHANGED" ] && [ -z "$INTROSPECTION_CHANGED" ]; then
  echo "No change in any of the packages."
  exit 0
fi

if [ "$BUILDKITE_BRANCH" != "master" ]; then
  buildkite-agent pipeline upload .buildkite/test.yml
  echo "Not building anything if it's not on master"
  exit 0
fi

# the simplest case first: only change in `prisma2`
if [ "$PRISMA2_CHANGED" ] && [ -z "$CLI_CHANGE" ] && [ -z "$INTROSPECTION_CHANGED" ]; then
  buildkite-agent pipeline upload .buildkite/publish-prisma2.yml
  exit 0
fi

# next case: change in introspection, but not cli
if [ "$INTROSPECTION_CHANGED" ] && [ -z "$CLI_CHANGE" ]; then
  buildkite-agent pipeline upload .buildkite/publish-introspection.yml
  exit 0
fi

# last case: cli change
if [ "$CLI_CHANGE" ]; then
  buildkite-agent pipeline upload .buildkite/publish-cli.yml
  exit 0
fi