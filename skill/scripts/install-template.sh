#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage:
  bash skill/scripts/install-template.sh <vault-path> [--force]

Installs the Obsidian AI workbench template into a local vault.
By default existing files are preserved. Use --force to overwrite template/plugin files after creating backups.
EOF
}

if [ $# -lt 1 ] || [ $# -gt 2 ]; then
  usage
  exit 2
fi

VAULT_PATH="$1"
FORCE="${2:-}"

if [ "$FORCE" != "" ] && [ "$FORCE" != "--force" ]; then
  usage
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ASSETS_DIR="$SKILL_DIR/assets"
STAMP="$(date "+%Y%m%d-%H%M%S")"

if [ ! -d "$VAULT_PATH" ]; then
  echo "Vault path does not exist: $VAULT_PATH" >&2
  exit 1
fi

copy_tree() {
  local src="$1"
  local dst="$2"
  mkdir -p "$dst"
  (cd "$src" && find . -type d -print) | while IFS= read -r dir; do
    dir="${dir#./}"
    [ -z "$dir" ] && continue
    mkdir -p "$dst/$dir"
  done
  (cd "$src" && find . -type f -print) | while IFS= read -r rel; do
    rel="${rel#./}"
    local from="$src/$rel"
    local to="$dst/$rel"
    mkdir -p "$(dirname "$to")"
    if [ -e "$to" ] && [ "$FORCE" != "--force" ]; then
      echo "skip existing: ${to#$VAULT_PATH/}"
      continue
    fi
    if [ -e "$to" ] && [ "$FORCE" = "--force" ]; then
      cp "$to" "$to.bak.$STAMP"
    fi
    cp "$from" "$to"
  done
}

mkdir -p "$VAULT_PATH/.obsidian/plugins" "$VAULT_PATH/.hermes-codex-note-ops"

copy_tree "$ASSETS_DIR/vault-template" "$VAULT_PATH"
copy_tree "$ASSETS_DIR/obsidian-plugin/hermes-codex-note-ops" "$VAULT_PATH/.obsidian/plugins/hermes-codex-note-ops"
copy_tree "$ASSETS_DIR/note-ops" "$VAULT_PATH/.hermes-codex-note-ops"

chmod +x "$VAULT_PATH/.hermes-codex-note-ops/scripts/note-action.sh" 2>/dev/null || true

cat <<EOF
Installed Obsidian AI workbench template into:
  $VAULT_PATH

Next steps:
  1. Open Obsidian.
  2. Enable Community plugins if needed.
  3. Enable "Hermes Codex Note Ops".
  4. Open a Markdown note and click the side-ribbon workbench icon.
EOF

if [ ! -f "$VAULT_PATH/.gitignore" ]; then
  cat > "$VAULT_PATH/.gitignore" <<'EOF'
# AI Workbench Operations
AI操作台/运行日志/
AI操作台/备份/
EOF
  echo "Created vault .gitignore with AI workbench privacy rules."
else
  if ! grep -Fq "AI操作台/运行日志/" "$VAULT_PATH/.gitignore"; then
    cat >> "$VAULT_PATH/.gitignore" <<'EOF'

# AI Workbench Operations
AI操作台/运行日志/
AI操作台/备份/
EOF
    echo "Appended AI workbench privacy rules to vault .gitignore."
  fi
fi
