#!/bin/bash

set -ex

git clone git@github.com:timsuchanek/last-git-changes.git
cd last-git-changes
npm install
npm run build
cd ..
node last-git-changes/bin.js --exclude='docs,fixtures,README.md,LICENSE,CONTRIBUTING.md'
export CHANGED_COUNT=$(node last-git-changes/bin.js --exclude='docs,fixtures,README.md,LICENSE,CONTRIBUTING.md' | wc -l)

echo $CHANGED_COUNT

if [ $CHANGED_COUNT -gt 0 ]; then
  buildkite-agent pipeline upload .buildkite/trigger.yml
else
  echo "Nothing changed"
fi



