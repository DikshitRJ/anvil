#!/usr/bin/env bash
# Prepares the pinned pallets/flask 3.1.3 checkout used for the Anvil demo.
#
# Usage: scripts/demo/setup-flask.sh [target-dir]
#   target-dir defaults to $HOME/anvil-demo/flask
#
# Clones Flask if needed, checks out tag 3.1.3 (commit 22d92470), creates a
# .venv inside the target and installs Flask with dotenv and a compatible pytest version.
set -euo pipefail

TARGET="${1:-$HOME/anvil-demo/flask}"
FLASK_REPO="https://github.com/pallets/flask"
FLASK_TAG="3.1.3"
FLASK_COMMIT_PREFIX="22d92470"

if [ ! -d "$TARGET/.git" ]; then
  echo "Cloning $FLASK_REPO into $TARGET"
  mkdir -p "$(dirname "$TARGET")"
  git clone "$FLASK_REPO" "$TARGET"
fi

git -C "$TARGET" fetch --tags
git -C "$TARGET" checkout --quiet "tags/$FLASK_TAG"

HEAD_SHA="$(git -C "$TARGET" rev-parse HEAD)"
if [[ "$HEAD_SHA" != "$FLASK_COMMIT_PREFIX"* ]]; then
  echo "warning: HEAD is ${HEAD_SHA:0:8}, expected $FLASK_COMMIT_PREFIX for tag $FLASK_TAG" >&2
fi
echo "Flask checked out at $FLASK_TAG (${HEAD_SHA:0:8})"

if [ ! -d "$TARGET/.venv" ]; then
  python3 -m venv "$TARGET/.venv"
fi
# Flask 3.1.3 imports pytest internals removed in 9.2. Use its locked version.
(cd "$TARGET" && .venv/bin/python -m pip install --quiet -e ".[dotenv]" "pytest==9.0.2")

cat <<EOF

Flask $FLASK_TAG is ready at: $TARGET

Next steps:
  1. Open the folder in VS Code:  code "$TARGET"
  2. Start Anvil (Command Palette: "Anvil: Setup") and make sure TrueForge is running.
  3. Task A (inline edit): open src/flask/helpers.py, select get_debug_flag, and run
     Anvil inline edit. Then verify with:
       cd "$TARGET" && FLASK_DEBUG=off .venv/bin/python -c "from flask.helpers import get_debug_flag; print(get_debug_flag())"
     Expected output: False
  4. Task B (agent mode, three or more files): ask for the "flask config" command, accept the
     hunks, then verify with:
       cd "$TARGET" && .venv/bin/python -m pytest tests/test_cli.py -q
  5. Task C (resilience): repeat Task A with an unreachable endpoint or an invalid key.
  6. Reset between takes with: scripts/demo/reset-flask.sh "$TARGET"
EOF
