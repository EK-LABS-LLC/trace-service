#!/usr/bin/env bash
set -euo pipefail

REPO="${PULSE_REPO:-EK-LABS-LLC/trace-service}"
CLI_REPO="${PULSE_CLI_REPO:-EK-LABS-LLC/trace-cli}"
BINARY="pulse-server"
VERSION="${PULSE_VERSION:-latest}"
CLI_VERSION="${PULSE_CLI_VERSION:-latest}"
INSTALL_DIR="${PULSE_INSTALL_DIR:-$HOME/.local/bin}"
INSTALL_CLI=1

usage() {
  cat <<'EOF'
Usage: install.sh [pulse-server|pulse-server-scale] [--version <tag>|latest] [--cli-version <tag>|latest] [--install-dir <path>] [--server-only]

Examples:
  install.sh
  install.sh pulse-server-scale --version v0.1.0
  install.sh pulse-server --cli-version v0.1.0
  install.sh pulse-server --install-dir /usr/local/bin
EOF
}

# Parse install target/options.
while [[ $# -gt 0 ]]; do
  case "$1" in
    pulse-server|pulse-server-scale)
      BINARY="$1"
      shift
      ;;
    pulse)
      echo "Argument 'pulse' is deprecated. Installing 'pulse-server' instead."
      BINARY="pulse-server"
      shift
      ;;
    pulse-scale)
      echo "Argument 'pulse-scale' is deprecated. Installing 'pulse-server-scale' instead."
      BINARY="pulse-server-scale"
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
    --cli-version)
      if [[ $# -lt 2 ]]; then
        echo "--cli-version requires a value"
        exit 1
      fi
      CLI_VERSION="$2"
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
    --server-only|--no-cli)
      INSTALL_CLI=0
      shift
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

# Detect host OS/architecture so we pick the right release asset.
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

TMP_DIR="$(mktemp -d /tmp/pulse-install.XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

# Resolve release tag + verify artifact integrity against checksums.
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

# Download + verify server binary (supports new and legacy asset names).
BASE_URL="https://github.com/${REPO}/releases/download/${TAG}"
CHECKSUM_URL="${BASE_URL}/checksums.txt"
curl -fL "$CHECKSUM_URL" -o "${TMP_DIR}/checksums.txt"
ASSET_CANDIDATES=("${BINARY}-${OS}-${ARCH}")
case "$BINARY" in
  pulse-server)
    ASSET_CANDIDATES+=("pulse-${OS}-${ARCH}")
    ;;
  pulse-server-scale)
    ASSET_CANDIDATES+=("pulse-scale-${OS}-${ARCH}")
    ;;
esac

DOWNLOADED_ASSET=""
for CANDIDATE in "${ASSET_CANDIDATES[@]}"; do
  BINARY_URL="${BASE_URL}/${CANDIDATE}"
  if curl -fsL "$BINARY_URL" -o "${TMP_DIR}/${CANDIDATE}"; then
    DOWNLOADED_ASSET="${CANDIDATE}"
    break
  fi
done

if [[ -z "$DOWNLOADED_ASSET" ]]; then
  echo "Could not download a release asset for ${BINARY} (${OS}/${ARCH}) at tag ${TAG}"
  exit 1
fi

echo "Downloaded ${DOWNLOADED_ASSET} (${TAG})"

EXPECTED_HASH="$(awk -v name="${DOWNLOADED_ASSET}" '$2 == name {print $1}' "${TMP_DIR}/checksums.txt")"
if [[ -z "$EXPECTED_HASH" ]]; then
  echo "No checksum entry found for ${DOWNLOADED_ASSET}"
  exit 1
fi

ACTUAL_HASH="$(sha256_file "${TMP_DIR}/${DOWNLOADED_ASSET}")"
if [[ "$EXPECTED_HASH" != "$ACTUAL_HASH" ]]; then
  echo "Checksum mismatch for ${DOWNLOADED_ASSET}"
  echo "Expected: ${EXPECTED_HASH}"
  echo "Actual:   ${ACTUAL_HASH}"
  exit 1
fi

mkdir -p "$INSTALL_DIR"
install -m 0755 "${TMP_DIR}/${DOWNLOADED_ASSET}" "${INSTALL_DIR}/${BINARY}"

echo "Installed ${BINARY} to ${INSTALL_DIR}/${BINARY}"

# Optionally install the CLI so users have a ready-to-use local setup.
if [[ "$INSTALL_CLI" == "1" ]]; then
  if [[ "$CLI_VERSION" == "latest" ]]; then
    CLI_INSTALL_SCRIPT_URL="https://raw.githubusercontent.com/${CLI_REPO}/main/install.sh"
    echo "Installing pulse CLI (latest)..."
    curl -fsSL "$CLI_INSTALL_SCRIPT_URL" | PULSE_INSTALL_DIR="$INSTALL_DIR" sh
  else
    CLI_INSTALL_SCRIPT_URL="https://raw.githubusercontent.com/${CLI_REPO}/${CLI_VERSION}/install.sh"
    echo "Installing pulse CLI (${CLI_VERSION})..."
    curl -fsSL "$CLI_INSTALL_SCRIPT_URL" | PULSE_INSTALL_DIR="$INSTALL_DIR" PULSE_VERSION="$CLI_VERSION" sh
  fi
fi

if [[ ":${PATH}:" != *":${INSTALL_DIR}:"* ]]; then
  echo "Add ${INSTALL_DIR} to PATH:"
  echo "  export PATH=\"${INSTALL_DIR}:\$PATH\""
fi
