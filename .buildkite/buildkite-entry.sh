#!/bin/bash

set -ex


npx last-git-changes --exclude='docs,examples,scripts,README.md,LICENSE,CONTRIBUTING.md'

# buildkite-agent pipeline upload .buildkite/trigger.yml

