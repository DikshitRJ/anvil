#!/usr/bin/env bash
# Resets the Flask demo checkout to a clean state: discards tracked changes and
# removes untracked files. Ignored files (such as .venv) are kept.
#
# Usage: scripts/demo/reset-flask.sh [-y] [target-dir]
#   -y          skip the confirmation prompt
#   target-dir  defaults to $HOME/anvil-demo/flask
set -euo pipefail

ASSUME_YES=0
if [ "${1:-}" = "-y" ]; then
  ASSUME_YES=1
  shift
fi

TARGET="${1:-$HOME/anvil-demo/flask}"

if [ ! -d "$TARGET/.git" ]; then
  echo "error: $TARGET is not a git checkout" >&2
  exit 1
fi

if [ "$ASSUME_YES" -eq 0 ]; then
  echo "This discards all uncommitted changes and untracked files in: $TARGET"
  read -r -p "Continue? [y/N] " answer || answer=""
  case "$answer" in
    y | Y | yes | YES) ;;
    *)
      echo "Aborted."
      exit 1
      ;;
  esac
fi

git -C "$TARGET" checkout -- .
git -C "$TARGET" clean -fd
echo "Reset $TARGET to a clean state."
