#!/usr/bin/env bash
set -euo pipefail

version_from_package_json() {
  sed -nE 's/^[[:space:]]*"version":[[:space:]]*"([^"]+)".*/\1/p' "$1" | head -n 1
}

latest_tag_version() {
  git tag --list 'v[0-9]*' --sort=-v:refname | head -n 1 | sed 's/^v//'
}

version_gt() {
  local current="$1"
  local base="$2"
  local current_major current_minor current_patch
  local base_major base_minor base_patch

  IFS=. read -r current_major current_minor current_patch <<< "$current"
  IFS=. read -r base_major base_minor base_patch <<< "$base"

  for part in "$current_major" "$current_minor" "$current_patch" "$base_major" "$base_minor" "$base_patch"; do
    if [[ ! "$part" =~ ^[0-9]+$ ]]; then
      echo "::error::Expected semantic versions in X.Y.Z format; got current=$current base=$base." >&2
      exit 1
    fi
  done

  if (( 10#$current_major != 10#$base_major )); then
    (( 10#$current_major > 10#$base_major ))
    return
  fi

  if (( 10#$current_minor != 10#$base_minor )); then
    (( 10#$current_minor > 10#$base_minor ))
    return
  fi

  (( 10#$current_patch > 10#$base_patch ))
}

base_ref="${BASE_REF:-origin/${GITHUB_BASE_REF:-main}}"
current_version="$(version_from_package_json package.json)"
base_package="$(mktemp)"
trap 'rm -f "$base_package"' EXIT

if git show "$base_ref:package.json" > "$base_package"; then
  base_version="$(version_from_package_json "$base_package")"
else
  base_version=""
fi

if [[ -z "$base_version" ]]; then
  base_version="$(latest_tag_version)"
fi

if [[ -z "$current_version" || -z "$base_version" ]]; then
  echo "::error::Could not resolve trace-service versions. current=$current_version base=$base_version" >&2
  exit 1
fi

if ! version_gt "$current_version" "$base_version"; then
  echo "::error::trace-service version must be bumped above $base_version before merging this PR. Current version is $current_version." >&2
  exit 1
fi

echo "trace-service version bump OK: $base_version -> $current_version."
