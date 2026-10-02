#!/usr/bin/env bash
# Prints one version's section of CHANGELOG.md, for the GitHub release body.
# Usage: scripts/release-notes.sh 1.0.0
set -euo pipefail

version="${1:?usage: scripts/release-notes.sh <version>}"
changelog="$(dirname "$0")/../CHANGELOG.md"

notes="$(awk -v v="$version" '
  index($0, "## [" v "]") == 1 { found = 1; next }
  found && /^## \[/ { exit }
  found { print }
' "$changelog" | sed -e '/./,$!d')"

if [ -z "$notes" ]; then
  echo "No section for $version in CHANGELOG.md" >&2
  exit 1
fi
printf '%s\n' "$notes"
