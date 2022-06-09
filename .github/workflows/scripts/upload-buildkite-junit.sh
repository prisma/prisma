#!/bin/bash

set -ex

curl \
  -X POST \
  -H "Authorization: Token token=\"$BUILDKITE_ANALYTICS_TOKEN\"" \
  -F "data=@$1" \
  -F "format=junit" \
  -F "run_env[CI]=github_actions" \
  -F "run_env[key]=$GITHUB_ACTION-$GITHUB_RUN_NUMBER-$GITHUB_RUN_ATTEMPT" \
  -F "run_env[number]=$GITHUB_RUN_NUMBER" \
  -F "run_env[branch]=$GITHUB_REF" \
  -F "run_env[commit_sha]=$GITHUB_SHA" \
  -F "run_env[url]=https://github.com/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID" \
  https://analytics-api.buildkite.com/v1/uploads
