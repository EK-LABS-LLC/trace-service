#!/usr/bin/env bash
set -euo pipefail

REPO="${PULSE_REPO:-EK-LABS-LLC/trace-service}"
BINARY="pulse"
VERSION="${PULSE_VERSION:-latest}"
INSTALL_DIR="${PULSE_INSTALL_DIR:-$HOME/.local/bin}"

usage() {
  cat <<'EOF'
Usage: install.sh [pulse|pulse-scale] [--version <tag>|latest] [--install-dir <path>]

Examples:
  install.sh pulse
  install.sh pulse-scale --version v0.1.0
  install.sh pulse --install-dir /usr/local/bin
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    pulse|pulse-scale)
      BINARY="$1"
      shift
      ;;
    --version)
      if [[ $# -lt 2 ]]; then
        echo "--version requires a value"
        exit 1
      fi
      VERSION="$2"
      shift 2
      ;;
    --install-dir)
      if [[ $# -lt 2 ]]; then
        echo "--install-dir requires a value"
        exit 1
      fi
      INSTALL_DIR="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      usage
      exit 1
      ;;
  esac
done

case "$(uname -s)" in
  Linux) OS="linux" ;;
  Darwin) OS="darwin" ;;
  *)
    echo "Unsupported operating system: $(uname -s)"
    exit 1
    ;;
esac

case "$(uname -m)" in
  x86_64|amd64) ARCH="amd64" ;;
  arm64|aarch64) ARCH="arm64" ;;
  *)
    echo "Unsupported architecture: $(uname -m)"
    exit 1
    ;;
esac

ASSET="${BINARY}-${OS}-${ARCH}"
TMP_DIR="$(mktemp -d /tmp/pulse-install.XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

fetch_tag() {
  local api_url="https://api.github.com/repos/${REPO}/releases/latest"
  curl -fsSL "$api_url" | sed -n 's/.*"tag_name":[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1
}

sha256_file() {
  local path="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$path" | awk '{print $1}'
    return
  fi
  shasum -a 256 "$path" | awk '{print $1}'
}

if [[ "$VERSION" == "latest" ]]; then
  TAG="$(fetch_tag)"
  if [[ -z "$TAG" ]]; then
    echo "Could not resolve latest release tag from ${REPO}"
    exit 1
  fi
else
  TAG="$VERSION"
fi

BASE_URL="https://github.com/${REPO}/releases/download/${TAG}"
BINARY_URL="${BASE_URL}/${ASSET}"
CHECKSUM_URL="${BASE_URL}/checksums.txt"

echo "Downloading ${ASSET} (${TAG})..."
curl -fL "$BINARY_URL" -o "${TMP_DIR}/${ASSET}"
curl -fL "$CHECKSUM_URL" -o "${TMP_DIR}/checksums.txt"

EXPECTED_HASH="$(awk -v name="${ASSET}" '$2 == name {print $1}' "${TMP_DIR}/checksums.txt")"
if [[ -z "$EXPECTED_HASH" ]]; then
  echo "No checksum entry found for ${ASSET}"
  exit 1
fi

ACTUAL_HASH="$(sha256_file "${TMP_DIR}/${ASSET}")"
if [[ "$EXPECTED_HASH" != "$ACTUAL_HASH" ]]; then
  echo "Checksum mismatch for ${ASSET}"
  echo "Expected: ${EXPECTED_HASH}"
  echo "Actual:   ${ACTUAL_HASH}"
  exit 1
fi

mkdir -p "$INSTALL_DIR"
install -m 0755 "${TMP_DIR}/${ASSET}" "${INSTALL_DIR}/${BINARY}"

echo "Installed ${BINARY} to ${INSTALL_DIR}/${BINARY}"
if [[ ":${PATH}:" != *":${INSTALL_DIR}:"* ]]; then
  echo "Add ${INSTALL_DIR} to PATH:"
  echo "  export PATH=\"${INSTALL_DIR}:\$PATH\""
fi
