# Obsidian AI Workbench Template

一个可复用的 Obsidian 中文知识库模板：把 Vault 顶层结构、AI 操作台、自定义插件、Hermes/Codex 笔记动作和发布型写作工作流打包成 Codex Skill。

## 包含什么

- 中文 Vault 分类：内容创作、AI 工具与工作流、项目复盘、资料剪藏、每日简报、媒体素材、模板和归档。
- `Hermes Codex Note Ops` Obsidian 插件：在侧边栏对当前笔记执行公众号改写、小红书拆条、选题提炼、摘要路标、润色原文、补标签双链、智能元数据。
- Hermes 模型选择：插件会读取本机 `~/.hermes/models.json` 和 `~/.hermes/config.yaml` 里的非敏感模型名，让用户选择本次动作使用哪个模型。
- 安装脚本：把模板目录、插件和动作模板复制进目标 Vault。
- Codex Skill：让 AI 助手能按同一套流程安装、维护、排错和扩展这个工作台。

## 快速安装

```bash
cd /path/to/obsidian-ai-workbench-template
bash skill/scripts/install-template.sh "/path/to/Your Obsidian Vault"
```

安装后在 Obsidian 里打开 `Settings -> Community plugins`，启用 `Hermes Codex Note Ops`，再点击左侧丝光图标打开“当前笔记操作台”。

## 依赖

- Obsidian Desktop。
- 可选：Hermes CLI，用于默认 AI 动作。
- 可选：Codex CLI，用于把引擎切到 Codex 后执行动作。

## 安全边界

这个仓库只保存模板和插件代码，不保存个人 Vault 内容、API key、OAuth token、cookie、`.codex`、`.hermes` 私有状态、会话历史、运行日志或备份文件。跨设备同步时建议只同步本仓库或你的公开模板仓库，真实知识库请单独选择 Obsidian Sync、私有 Git 仓库或其他受控方式。

## 目录

```text
skill/
  SKILL.md
  agents/openai.yaml
  assets/
    obsidian-plugin/hermes-codex-note-ops/
    note-ops/
    vault-template/
  references/
  scripts/install-template.sh
docs/
examples/
```

## 发布建议

如果你要把这个项目写成公众号文章，可以把重点放在“混乱素材库到可操作知识工作台”的转变，而不是只介绍插件。推荐结构见 `docs/publishing-notes.md`。

