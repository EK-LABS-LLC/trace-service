#!/usr/bin/env bash
set -euo pipefail

version="${1:-}"

if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Usage: make bump VERSION=x.y.z" >&2
  exit 2
fi

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

sed -E "s/^([[:space:]]*\"version\":[[:space:]]*\")[^\"]+(\",?)$/\1$version\2/" package.json > "$tmp"
mv "$tmp" package.json

echo "Updated trace-service version to $version."
