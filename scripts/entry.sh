#!/bin/bash

set -ex

# NO_PUBLISH comes from a pipeline trigger and not from an ordinary push
# in this case we only want to test
if [[ $NO_PUBLISH ]]; then
  buildkite-agent pipeline upload .buildkite/test.yml
  exit 0
fi

if [ $BULIDKITE_BRANCH != "master" ]; then
  buildkite-agent pipeline upload .buildkite/test.yml
  echo "Not building anything if it's not on master"
  exit 0
fi

# let's publish
buildkite-agent pipeline upload .buildkite/publish-lift.yml
