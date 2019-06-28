#!/bin/bash

set -ex

if [[ $NO_PUBLISH ]]; then
  buildkite-agent pipeline upload .buildkite/test.yml
  exit 0
fi

if [ $BULIDKITE_BRANCH != "master" ]; then
  echo "Not building anything if it's not on master"
  exit 0
fi

if [[ $BUILDKITE_COMMIT ]]; then
  export LAST_COMMIT=$BUILDKITE_COMMIT
else
  export LAST_COMMIT=$(git merge-base --fork-point HEAD)
fi

# let's test
buildkite-agent pipeline upload .buildkite/test.yml

# let's publish
buildkite-agent pipeline upload .buildkite/publish-lift.yml
