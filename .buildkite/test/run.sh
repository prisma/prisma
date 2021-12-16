#!/bin/bash

set -ex

# Thanks to https://gist.github.com/sj26/88e1c6584397bb7c13bd11108a579746
# Retry a command up to a specific numer of times until it exits successfully
#
#  $ retry 5 echo Hello
#  Hello
#
#  $ retry 5 false
#  Retry 1/5 exited 1, retrying in 20 seconds...
#  Retry 2/5 exited 1, retrying in 40 seconds...
#  Retry 3/5 exited 1, retrying in 80 seconds...
#  Retry 4/5 exited 1, retrying in 160 seconds...
#  Retry 5/5 exited 1, no more retries left.
#  
function retry {
  local retries=$1
  shift

  local count=0
  until "$@"; do
    exit=$?
    
    if [ $count == 0 ]; then
      wait=20
    else
      wait=$((2 * $wait))
    fi
    
    count=$(($count + 1))
    if [ $count -lt $retries ]; then
      echo "Retry $count/$retries exited $exit, retrying in $wait seconds..."
      sleep $wait
    else
      echo "Retry $count/$retries exited $exit, no more retries left."
      return $exit
    fi
  done
  return 0
}

# The below is required as during install required engines are downloaded, so this makes sure the engines being tested are already present 

# JOB 0 - Node-API Library
if [ "$BUILDKITE_PARALLEL_JOB" = "0" ]; then
  export PRISMA_CLIENT_ENGINE_TYPE='library'
  export PRISMA_CLI_QUERY_ENGINE_TYPE='library'
fi
# JOB 1 - Binary
if [ "$BUILDKITE_PARALLEL_JOB" = "1" ]; then
  export PRISMA_CLIENT_ENGINE_TYPE='binary'
  export PRISMA_CLI_QUERY_ENGINE_TYPE='binary'
fi

npm i --silent -g pnpm@6 --unsafe-perm

retry 6 pnpm i --no-prefer-frozen-lockfile


# JOB 0
if [ "$BUILDKITE_PARALLEL_JOB" = "0" ]; then
  # Only run lint for job 0
  pnpm run lint
fi



node -v
npm -v

pnpm run setup

pnpm run test
