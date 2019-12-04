#!/bin/bash

set -ex


whoami
node --version
npm --version
git clone git@github.com:timsuchanek/last-git-changes.git
cd last-git-changes
npm install
npm run build
cd ..
export CHANGED_COUNT=$(node last-git-changes/bin.js --exclude='docs,examples,scripts,README.md,LICENSE,CONTRIBUTING.md' | wc -l)

echo $CHANGED_COUNT

if [ $CHANGED_COUNT -gt 0 ]; then
  buildkite-agent pipeline upload .buildkite/trigger.yml
else
  echo "Nothing changed"
fi


