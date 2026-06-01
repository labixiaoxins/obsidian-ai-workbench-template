---
name: obsidian-ai-workbench-template
description: Use when installing, packaging, maintaining, or extending an Obsidian Chinese AI workbench template with Hermes/Codex Note Ops, Chinese vault taxonomy, note action templates, model selection, safe backups, and publishable project documentation.
---

# Obsidian AI Workbench Template

Use this skill when the user wants to install or maintain the Obsidian AI workbench template, reproduce the Chinese vault structure, repair the Hermes/Codex note-operation plugin, or extend the action templates.

## Guardrails

- Never copy or publish private notes unless the user explicitly identifies a small public sample.
- Never copy `.codex`, `.hermes`, API keys, OAuth tokens, cookies, sessions, logs, history, provider state, or runtime backups.
- Treat `~/.hermes/models.json` and `~/.hermes/config.yaml` as local runtime inputs only. The plugin may read non-secret provider/model names, but template repos must not include those files.
- Before modifying a live Vault, create a backup or preserve existing files with `.bak.<timestamp>` when overwriting.
- Keep Obsidian link safety in mind: move real notes with link updates; install templates by copying sample files only.

## Standard Workflow

1. Confirm the target Vault path.
2. Read `references/vault-structure.md` if the user asks about the taxonomy.
3. Run `scripts/install-template.sh <vault-path>` from this skill directory when installing.
4. Ask the user to enable `Hermes Codex Note Ops` inside Obsidian Community plugins if it is not already enabled.
5. Verify:
   - `.obsidian/plugins/hermes-codex-note-ops/main.js` exists.
   - `.hermes-codex-note-ops/scripts/note-action.sh` exists and is executable.
   - `AI操作台/运行结果/当前笔记/00-当前笔记说明.md` exists.
   - `AI操作台/备份/00-备份说明.md` exists.
6. For plugin edits, syntax-check with:

```bash
node --check .obsidian/plugins/hermes-codex-note-ops/main.js
bash -n .hermes-codex-note-ops/scripts/note-action.sh
```

## Extending Actions

- Add a new Markdown prompt under `assets/note-ops/actions/<action-id>.md`.
- Add the matching action entry to `assets/obsidian-plugin/hermes-codex-note-ops/data.json` and `DEFAULT_SETTINGS.actions` in `main.js`.
- Use `kind: "output"` for actions that create a new file.
- Use `kind: "modify"` only when the action should back up and overwrite the current note.
- Keep prompts grounded: no invented facts, no unsupported numbers, and clear Markdown output requirements.

## Useful References

- `references/vault-structure.md`: Chinese Vault folders and intended use.
- `references/plugin-architecture.md`: how the Obsidian plugin calls the shell action runner.
- `references/security.md`: publishing and cross-device safety rules.

