#!/bin/bash

# Usage: `./version.sh x.y.z` will set the `x.y.z` to every package in the monorepo.

target_version=$1
package_dirs=$(pnpm -r list -r --depth -1 --json | jq -r '.[] | .path' | tail -n +2)

# Iterate through each package directory
for package_dir in $package_dirs; do
  # Check if the directory exists
  if [ -d "$package_dir" ]; then
    # Set the target version using pnpm
    (cd "$package_dir" && pnpm version "$target_version" --no-git-tag-version --allow-same-version)
  fi
done
