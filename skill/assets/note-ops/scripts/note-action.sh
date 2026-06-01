#!/usr/bin/env bash
set -euo pipefail

export LANG="${LANG:-C.UTF-8}"
export LC_ALL="${LC_ALL:-C.UTF-8}"
export PATH="$HOME/.local/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

if [ $# -lt 2 ]; then
  echo "用法: bash .hermes-codex-note-ops/scripts/note-action.sh <action> <note-path> [profile] [engine] [hermes-model-spec]" >&2
  exit 1
fi

ACTION="$1"
NOTE_REL="$2"
PROFILE_ID="${3:-balanced}"
ENGINE="${4:-hermes}"
HERMES_MODEL_SPEC="${5:-__default}"
VAULT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NOTE_ABS="$VAULT_ROOT/$NOTE_REL"
OPS_DIR="$VAULT_ROOT/.hermes-codex-note-ops"
ACTION_FILE="$OPS_DIR/actions/$ACTION.md"
PROFILE_FILE="$OPS_DIR/profiles/$PROFILE_ID.md"
RESULTS_DIR="$VAULT_ROOT/AI操作台/运行结果/当前笔记"
BACKUP_DIR="$VAULT_ROOT/AI操作台/备份"
LOG_DIR="$VAULT_ROOT/AI操作台/运行日志"

if [ ! -f "$NOTE_ABS" ]; then
  echo "找不到当前笔记: $NOTE_REL" >&2
  exit 1
fi

if [ ! -f "$ACTION_FILE" ]; then
  echo "找不到动作模板: $ACTION_FILE" >&2
  exit 1
fi

mkdir -p "$RESULTS_DIR" "$BACKUP_DIR" "$LOG_DIR"

BASE="$(basename "$NOTE_REL" .md)"
STAMP="$(date "+%Y%m%d-%H%M%S")"
NOTE_HASH="$(printf "%s" "$NOTE_REL" | shasum -a 1 | awk '{print substr($1,1,10)}')"
RUN_ID="$STAMP-$$-$NOTE_HASH"
SAFE_STEM="$RUN_ID"
LAST_LOG="$LOG_DIR/$RUN_ID-$ACTION.log"

resolve_cli() {
  local name="$1"
  local candidate
  if candidate="$(command -v "$name" 2>/dev/null)" && [ -x "$candidate" ]; then
    printf "%s\n" "$candidate"
    return 0
  fi
  for candidate in \
    "$HOME/.local/bin/$name" \
    "/usr/local/bin/$name" \
    "/opt/homebrew/bin/$name" \
    "/usr/bin/$name" \
    "/bin/$name"; do
    if [ -x "$candidate" ]; then
      printf "%s\n" "$candidate"
      return 0
    fi
  done
  if candidate="$(/bin/zsh -lc "command -v $name" 2>/dev/null)" && [ -x "$candidate" ]; then
    printf "%s\n" "$candidate"
    return 0
  fi
  return 1
}

read_profile() {
  if [ "$PROFILE_ID" = "__none" ]; then
    return
  fi
  if [ -f "$PROFILE_FILE" ]; then
    cat "$PROFILE_FILE"
  elif [ -f "$OPS_DIR/profiles/balanced.md" ]; then
    cat "$OPS_DIR/profiles/balanced.md"
  else
    echo "使用清晰、准确、克制的中文表达，保留原文事实，不编造细节。"
  fi
}

profile_label() {
  case "$PROFILE_ID" in
    __none) echo "结构化" ;;
    balanced) echo "均衡清晰" ;;
    creator) echo "创作者观点流" ;;
    spoken) echo "上镜口播" ;;
    tutorial) echo "专业教程" ;;
    *) echo "$PROFILE_ID" ;;
  esac
}

action_label() {
  case "$ACTION" in
    wechat-article) echo "公众号改写" ;;
    xiaohongshu-cards) echo "小红书拆条" ;;
    topic-bank) echo "提炼选题" ;;
    summary-map) echo "摘要路标" ;;
    polish-in-place) echo "润色原文" ;;
    obsidian-format) echo "标签双链" ;;
    auto-metadata) echo "智能元数据" ;;
    *) echo "$ACTION" ;;
  esac
}

build_prompt() {
  cat <<EOF
你正在处理一个本地 Obsidian vault 中的 Markdown 笔记。

当前笔记相对路径：
$NOTE_REL

当前笔记全文：

$(cat "$NOTE_ABS")

EOF

  if [ "$PROFILE_ID" != "__none" ]; then
    cat <<EOF
文风模板：
$(read_profile)

EOF
  fi

  cat <<EOF
任务要求：
$(cat "$ACTION_FILE")

通用限制：
1. 不要编造原文没有的事实、数字、案例、链接。
2. 保留有价值的信息密度，不要把内容改成空泛鸡汤。
3. 输出必须是 Markdown。
4. 如果信息不足，请明确标出“需要补充”，不要瞎补。
EOF
}

run_hermes() {
  local prompt_file="$1"
  local hermes_bin
  local provider=""
  local model=""
  if ! hermes_bin="$(resolve_cli hermes)"; then
    echo "Hermes CLI 未找到。请确认 Hermes 已安装。" >&2
    return 127
  fi
  if [ -n "$HERMES_MODEL_SPEC" ] && [ "$HERMES_MODEL_SPEC" != "__default" ]; then
    if [[ "$HERMES_MODEL_SPEC" == *"|"* ]]; then
      provider="${HERMES_MODEL_SPEC%%|*}"
      model="${HERMES_MODEL_SPEC#*|}"
      "$hermes_bin" -m "$model" --provider "$provider" -z "请读取这个本地文件并严格执行其中的任务要求，只输出最终 Markdown 结果，不要解释过程：$prompt_file" --ignore-rules
    else
      "$hermes_bin" -m "$HERMES_MODEL_SPEC" -z "请读取这个本地文件并严格执行其中的任务要求，只输出最终 Markdown 结果，不要解释过程：$prompt_file" --ignore-rules
    fi
  else
    "$hermes_bin" -z "请读取这个本地文件并严格执行其中的任务要求，只输出最终 Markdown 结果，不要解释过程：$prompt_file" --ignore-rules
  fi
}

run_codex() {
  local prompt_file="$1"
  local result_file
  local codex_bin
  if ! codex_bin="$(resolve_cli codex)"; then
    echo "Codex CLI 未找到。请确认 Codex 已安装。" >&2
    return 127
  fi
  result_file="$(mktemp)"
  "$codex_bin" exec --skip-git-repo-check --ephemeral --ignore-rules -s danger-full-access -C "$VAULT_ROOT" -o "$result_file" "请读取这个本地文件并严格执行其中的任务要求，只输出最终 Markdown 结果，不要解释过程：$prompt_file" >/dev/null
  cat "$result_file"
  rm -f "$result_file"
}

run_ai() {
  local prompt_file="$1"
  case "$ENGINE" in
    hermes) run_hermes "$prompt_file" ;;
    codex) run_codex "$prompt_file" ;;
    *)
      echo "未知引擎: $ENGINE" >&2
      return 2
      ;;
  esac
}

write_log_header() {
  {
    echo "# AI 操作台运行日志"
    echo
    echo "- 时间: $STAMP"
    echo "- 动作: $ACTION"
    echo "- 引擎: $ENGINE"
    if [ "$ENGINE" = "hermes" ]; then
      echo "- Hermes 模型: $HERMES_MODEL_SPEC"
    fi
    echo "- 笔记: $NOTE_REL"
    echo "- Hash: $NOTE_HASH"
    echo "- Run ID: $RUN_ID"
    echo "- Hermes: $(resolve_cli hermes 2>/dev/null || echo 未找到)"
    echo "- Codex: $(resolve_cli codex 2>/dev/null || echo 未找到)"
    echo
  } > "$LAST_LOG"
}

run_ai_to_file() {
  local prompt_file="$1"
  local output_file="$2"
  write_log_header
  {
    echo "## Prompt 文件"
    echo "$prompt_file"
    echo
    echo "## 输出"
  } >> "$LAST_LOG"
  if run_ai "$prompt_file" > "$output_file" 2>> "$LAST_LOG"; then
    cat "$output_file" >> "$LAST_LOG"
    return 0
  fi
  {
    echo
    echo "## 失败摘要"
    echo "动作执行失败。完整错误见本日志。"
  } >> "$LAST_LOG"
  echo "动作执行失败。运行日志: ${LAST_LOG#$VAULT_ROOT/}" >&2
  return 1
}

strip_markdown_fence() {
  local file="$1"
  python3 - "$file" <<'PY'
import pathlib
import re
import sys

path = pathlib.Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
match = re.fullmatch(r"\s*```(?:markdown|md)?\s*\n(.*?)\n```\s*", text, re.S | re.I)
if match:
    path.write_text(match.group(1).rstrip() + "\n", encoding="utf-8")
PY
}

run_output_action() {
  local out="$RESULTS_DIR/$(action_label)-$SAFE_STEM.md"
  local prompt_file
  prompt_file="$(mktemp)"
  build_prompt > "$prompt_file"
  if ! run_ai_to_file "$prompt_file" "$out"; then
    rm -f "$out" "$prompt_file"
    exit 1
  fi
  strip_markdown_fence "$out"
  {
    printf "\n---\n\n"
    printf "源笔记: [[%s]]\n\n" "$BASE"
    printf "源路径: \`%s\`\n\n" "$NOTE_REL"
    printf "运行日志: \`%s\`\n" "${LAST_LOG#$VAULT_ROOT/}"
  } >> "$out"
  rm -f "$prompt_file"
  echo "OUTPUT:${out#$VAULT_ROOT/}"
}

run_modify_action() {
  local backup="$BACKUP_DIR/$SAFE_STEM.md"
  local next_file
  local prompt_file
  cp "$NOTE_ABS" "$backup"
  next_file="$(mktemp)"
  prompt_file="$(mktemp)"
  {
    build_prompt
    cat <<EOF

你现在要输出“修改后的完整原文 Markdown”。
只输出完整 Markdown 正文，不要包裹代码块，不要解释过程。
EOF
  } > "$prompt_file"
  if ! run_ai_to_file "$prompt_file" "$next_file"; then
    rm -f "$next_file" "$prompt_file"
    exit 1
  fi
  strip_markdown_fence "$next_file"
  if [ ! -s "$next_file" ]; then
    echo "AI 返回为空，已保留备份且未覆盖原文: ${backup#$VAULT_ROOT/}" >&2
    rm -f "$next_file" "$prompt_file"
    exit 1
  fi
  cp "$next_file" "$NOTE_ABS"
  rm -f "$next_file" "$prompt_file"
  echo "OUTPUT:$NOTE_REL"
}

case "$ACTION" in
  wechat-article|xiaohongshu-cards|topic-bank|summary-map)
    run_output_action
    ;;
  polish-in-place|obsidian-format|auto-metadata)
    run_modify_action
    ;;
  *)
    echo "未知动作: $ACTION" >&2
    exit 1
    ;;
esac
