#!/bin/bash

set -ex


whoami
node --version
npm --version
npm i -g --unsafe-perm last-git-changes
git clone git@github.com:timsuchanek/last-git-changes.git
cd last-git-changes
npm install
npm run build
node bin.js --dir="../" --exclude='docs,examples,scripts,README.md,LICENSE,CONTRIBUTING.md'

buildkite-agent pipeline upload .buildkite/trigger.yml

