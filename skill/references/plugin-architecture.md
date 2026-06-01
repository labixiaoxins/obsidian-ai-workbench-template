# Plugin Architecture

`Hermes Codex Note Ops` is a desktop-only Obsidian plugin.

## Flow

1. The side panel locks onto the current Markdown file.
2. The user chooses engine, Hermes model, writing profile, and an action.
3. `main.js` calls `.hermes-codex-note-ops/scripts/note-action.sh`.
4. The shell runner builds a prompt from:
   - the current note
   - `actions/<action-id>.md`
   - optional `profiles/<profile-id>.md`
5. Output actions write a new Markdown file under `AI操作台/运行结果/当前笔记`.
6. Modify actions first copy the source note to `AI操作台/备份`, then replace the source note.
7. Every run writes a log under `AI操作台/运行日志`.

## Model Selection

The plugin reads local Hermes model metadata from:

- `~/.hermes/models.json`
- `~/.hermes/config.yaml`

Only provider/model names are used. These files are not part of the template and must not be copied into Git.

