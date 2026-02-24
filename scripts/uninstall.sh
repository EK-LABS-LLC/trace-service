#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${PULSE_INSTALL_DIR:-$HOME/.local/bin}"
PURGE_DATA=0
REMOVE_HOOKS=1

usage() {
  cat <<'EOF'
Usage: uninstall.sh [--install-dir <path>] [--purge-data] [--keep-hooks]

Examples:
  uninstall.sh
  uninstall.sh --install-dir /usr/local/bin
  uninstall.sh --purge-data

Notes:
  - Removes pulse-server and pulse binaries from the selected install dir.
  - Attempts to remove agent hooks with `pulse disconnect` before deleting the CLI binary.
  - `--purge-data` also removes ~/.pulse (config + local sqlite data).
EOF
}

# Parse options.
while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-dir)
      if [[ $# -lt 2 ]]; then
        echo "--install-dir requires a value"
        exit 1
      fi
      INSTALL_DIR="$2"
      shift 2
      ;;
    --purge-data)
      PURGE_DATA=1
      shift
      ;;
    --keep-hooks)
      REMOVE_HOOKS=0
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

# Best-effort hook cleanup (kept non-fatal so uninstall still completes).
if [[ "$REMOVE_HOOKS" == "1" ]]; then
  if command -v pulse >/dev/null 2>&1; then
    echo "Removing agent hooks via: pulse disconnect"
    pulse disconnect || echo "Warning: pulse disconnect failed; continuing uninstall."
  else
    echo "pulse CLI not found on PATH; skipping hook cleanup."
  fi
fi

# Remove installed binaries from the chosen install directory.
for bin in pulse pulse-server; do
  target="${INSTALL_DIR}/${bin}"
  if [[ -f "$target" ]]; then
    rm -f "$target"
    echo "Removed ${target}"
  else
    echo "Not found: ${target}"
  fi
done

# Optionally remove persisted local config/data.
if [[ "$PURGE_DATA" == "1" ]]; then
  if [[ -d "$HOME/.pulse" ]]; then
    rm -rf "$HOME/.pulse"
    echo "Removed $HOME/.pulse"
  else
    echo "Not found: $HOME/.pulse"
  fi
else
  echo "Kept local data at $HOME/.pulse (use --purge-data for full removal)."
fi

echo "Uninstall complete."
