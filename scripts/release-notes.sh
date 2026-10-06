#!/usr/bin/env bash
# Prints one version's section of CHANGELOG.md, for the GitHub release body.
# Wrapped lines are joined, since GitHub renders each newline in release notes as a line break.
# Usage: scripts/release-notes.sh 1.0.0
set -euo pipefail

version="${1:?usage: scripts/release-notes.sh <version>}"
changelog="$(dirname "$0")/../CHANGELOG.md"

notes="$(awk -v v="$version" '
  index($0, "## [" v "]") == 1 { found = 1; next }
  found && /^## \[/ { exit }
  !found { next }
  # A blank line, heading or list item starts a new block; anything else continues the last line.
  /^$/ || /^#/ || /^- / {
    if (buf != "") print buf
    buf = $0
    if (/^$/ || /^#/) { print buf; buf = "" }
    next
  }
  { sub(/^ +/, ""); buf = (buf == "") ? $0 : buf " " $0 }
  END { if (buf != "") print buf }
' "$changelog" | sed -e '/./,$!d')"

if [ -z "$notes" ]; then
  echo "No section for $version in CHANGELOG.md" >&2
  exit 1
fi
printf '%s\n' "$notes"
