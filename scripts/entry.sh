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

export FETCH_ENGINE_CHANGED_COUNT=$(git diff-tree --no-commit-id --name-only -r $LAST_COMMIT packages/fetch-engine | wc -l)

# did anytying in ./packages/fetch-engine change?
if [ $FETCH_ENGINE_CHANGED_COUNT -gt 0 ]; then
  export FETCH_ENGINE_CHANGED=true
fi

# did anytying in ./packages/engine-core change?
export ENGINE_CORE_CHANGED_COUNT=$(git diff-tree --no-commit-id --name-only -r $LAST_COMMIT packages/engine-core | wc -l)
if [ $ENGINE_CORE_CHANGED_COUNT -gt 0 ]; then
  export ENGINE_CORE_CHANGED=true
fi

# did anytying in ./packages/photon change?
export PHOTON_CHANGED_COUNT=$(git diff-tree --no-commit-id --name-only -r $LAST_COMMIT packages/photon | wc -l)
if [ $PHOTON_CHANGED_COUNT -gt 0 ]; then
  export PHOTON_CHANGED=true
fi

if [ -z "$FETCH_ENGINE_CHANGED" ] && [ -z "$ENGINE_CORE_CHANGED" ] && [ -z "$PHOTON_CHANGED" ]; then
  echo "No change in any of the packages."
  exit 0
fi

if [ $BUILDKITE_BRANCH != "master" ]; then
  buildkite-agent pipeline upload .buildkite/test.yml
  echo "Not building anything if it's not on master"
  exit 0
fi

# the simplest case first: only change in `photon`
if [ "$PHOTON_CHANGED" ] && [ -z "$ENGINE_CORE_CHANGE" ] && [ -z "$FETCH_ENGINE_CHANGED" ]; then
  buildkite-agent pipeline upload .buildkite/publish-photon.yml
  exit 0
fi

# next case: change in `engine-core`, but not `fetch-engine`
if [ "$ENGINE_CORE_CHANGED" ] && [ -z "$FETCH_ENGINE_CHANGE" ]; then
  buildkite-agent pipeline upload .buildkite/publish-engine-core.yml
  exit 0
fi

# last case: `fetch-engine`
if [ "$FETCH_ENGINE_CHANGED" ]; then
  buildkite-agent pipeline upload .buildkite/publish-fetch-engine.yml
  exit 0
fi