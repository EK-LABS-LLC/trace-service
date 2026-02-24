#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${PULSE_INSTALL_DIR:-$HOME/.local/bin}"
PURGE_DATA=0
REMOVE_HOOKS=1
PATH_SCAN=1

usage() {
  cat <<'EOF'
Usage: uninstall.sh [--install-dir <path>] [--purge-data] [--keep-hooks] [--no-path-scan]

Examples:
  uninstall.sh
  uninstall.sh --install-dir /usr/local/bin
  uninstall.sh --purge-data

Notes:
  - Removes pulse-server and pulse binaries from the selected install dir.
  - Also removes binaries discovered on PATH (for example ~/.local/bin or ~/.cargo/bin).
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
    --no-path-scan)
      PATH_SCAN=0
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
add_candidate() {
  local value="${1:-}"
  [[ -n "$value" ]] || return
  for existing in "${CANDIDATES[@]}"; do
    [[ "$existing" == "$value" ]] && return
  done
  CANDIDATES+=("$value")
}

remove_binary_candidates() {
  local bin="$1"
  CANDIDATES=()
  add_candidate "${INSTALL_DIR}/${bin}"
  add_candidate "$(command -v "$bin" 2>/dev/null || true)"

  if [[ "$PATH_SCAN" == "1" ]] && command -v which >/dev/null 2>&1; then
    while IFS= read -r resolved; do
      add_candidate "$resolved"
    done < <(which -a "$bin" 2>/dev/null || true)
  fi

  local removed=0
  local seen_existing=0
  for target in "${CANDIDATES[@]}"; do
    if [[ -f "$target" ]]; then
      seen_existing=1
      if rm -f "$target"; then
        echo "Removed ${target}"
        removed=1
      else
        echo "Warning: failed to remove ${target}"
      fi
    fi
  done

  if [[ "$seen_existing" == "0" ]]; then
    echo "Not found: ${bin} in ${INSTALL_DIR} or PATH"
  elif [[ "$removed" == "0" ]]; then
    echo "Warning: found ${bin}, but removal failed for all discovered paths."
  fi
}

for bin in pulse pulse-server; do
  remove_binary_candidates "$bin"
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
