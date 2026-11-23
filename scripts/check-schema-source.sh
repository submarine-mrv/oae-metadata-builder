#!/bin/sh
# Fails unless the bundled schema comes from an oae-data-protocol release tag or a commit on its main.
# A schema bundled from an unmerged protocol PR fails until `make schema` is rerun after that PR merges.
set -eu
version=${1:-$(node -p 'require("./src/schema/schema.bundled.json").version')}
repo=$(mktemp -d)
git clone --quiet --filter=blob:none --no-checkout https://github.com/submarine-mrv/oae-data-protocol.git "$repo"
case "$version" in
  *+dev.*)
    hash=${version##*+dev.}
    if git -C "$repo" merge-base --is-ancestor "$hash" origin/main 2>/dev/null; then
      echo "Schema $version is on oae-data-protocol main."
      exit 0
    fi
    echo "Schema $version is not on oae-data-protocol main. Rerun make schema after its PR merges."
    exit 1
    ;;
  *)
    if git -C "$repo" rev-parse -q --verify "refs/tags/v$version" >/dev/null; then
      echo "Schema $version is the v$version release."
      exit 0
    fi
    echo "Schema $version has no v$version tag in oae-data-protocol."
    exit 1
    ;;
esac
