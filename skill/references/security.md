# Security Rules

Do publish:

- plugin source code
- generic action prompts
- generic writing profiles
- sample notes
- install scripts
- documentation

Do not publish:

- real private notes or attachments
- `.codex/auth.json`
- `.codex` sessions, logs, histories, provider state
- `.hermes` API keys, config secrets, sessions, logs
- OAuth tokens, cookies, `.env` files
- Obsidian workspace state if it exposes private paths
- generated run logs and backup copies from live notes
- copied absolute local paths when a relative Obsidian path is enough

If the target Vault is Git-managed, make sure its own `.gitignore` excludes:

```text
AI操作台/运行日志/
AI操作台/备份/
```

Before publishing, scan for personal paths and obvious secret strings.
