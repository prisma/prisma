#!/bin/bash

set -ex

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
