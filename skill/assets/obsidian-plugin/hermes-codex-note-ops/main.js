const { Plugin, ItemView, Notice, TFile, setIcon } = require("obsidian");
const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const VIEW_TYPE = "hermes-codex-note-ops-view";
const SETTINGS_DIR = ".hermes-codex-note-ops";
const SCRIPT_PATH = ".hermes-codex-note-ops/scripts/note-action.sh";

const DEFAULT_SETTINGS = {
  engine: "hermes",
  selectedHermesModel: "__default",
  actionTimeoutMinutes: 30,
  selectedProfileId: "balanced",
  resultsDir: "AI操作台/运行结果/当前笔记",
  backupDir: "AI操作台/备份",
  actions: [
    { id: "wechat-article", label: "公众号改写", icon: "newspaper", kind: "output", usesProfile: true, description: "把当前笔记改写成一篇公众号长文。" },
    { id: "xiaohongshu-cards", label: "小红书拆条", icon: "image", kind: "output", usesProfile: true, description: "拆成 5 条小红书内容，并给出配图提示词。" },
    { id: "topic-bank", label: "提炼选题", icon: "lightbulb", kind: "output", usesProfile: false, description: "提炼公众号、视频号/B站、小红书选题池。" },
    { id: "summary-map", label: "摘要路标", icon: "map", kind: "output", usesProfile: false, description: "生成摘要、关键词、双链建议和下一步动作。" },
    { id: "polish-in-place", label: "备份后润色原文", icon: "wand-sparkles", kind: "modify", usesProfile: true, description: "先备份当前笔记，再润色原文。" },
    { id: "obsidian-format", label: "补标签双链", icon: "tags", kind: "modify", usesProfile: false, description: "先备份当前笔记，再补 frontmatter、摘要、标签和双链。" },
    { id: "auto-metadata", label: "智能补全元数据", icon: "file-cog", kind: "modify", usesProfile: false, description: "由 AI 分析当前笔记并补全 Frontmatter、分类标签与 Topic。" }
  ],
  profiles: [
    { id: "balanced", label: "均衡清晰", description: "保留信息密度，表达更清楚。" },
    { id: "creator", label: "创作者观点流", description: "开头有判断，适合公众号和深度内容。" },
    { id: "spoken", label: "上镜口播", description: "短句、口语、节奏强，适合录视频。" },
    { id: "tutorial", label: "专业教程", description: "步骤清楚，适合工具教程和操作指南。" }
  ]
};

class NoteOpsView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.currentFile = null;
    this.currentText = "";
    this.statusEl = null;
    this.modelSelectEl = null;
    this.running = false;
    this.actionButtons = [];
    this.refreshTimer = null;
  }

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    return "Hermes Codex Note Ops";
  }

  getIcon() {
    return "sparkles";
  }

  async onOpen() {
    this.registerEvent(this.app.workspace.on("file-open", () => this.refresh()));
    this.registerEvent(this.app.vault.on("modify", (file) => {
      if (this.currentFile && file.path === this.currentFile.path) this.scheduleRefresh();
    }));
    await this.refresh();
  }

  onClose() {
    if (this.refreshTimer) window.clearTimeout(this.refreshTimer);
  }

  scheduleRefresh() {
    if (this.refreshTimer) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      this.refresh();
    }, 1200);
  }

  async refresh() {
    const root = this.containerEl.children[1];
    root.empty();
    root.addClass("hc-note-ops");
    root.addClass("hc-note-ops-compact");
    this.actionButtons = [];

    const file = this.plugin.getSourceFile();
    if (!file) {
      this.renderEmpty(root);
      return;
    }

    this.currentFile = file;
    this.currentText = await this.app.vault.read(file);
    this.renderHeader(root);
    this.renderControls(root);
    this.renderNote(root, file);
    this.renderActions(root, {
      title: "输出到新文件",
      subtitle: "不会改原文，适合先探索方向。",
      badge: "安全生成",
      actions: this.plugin.settings.actions.filter((action) => action.kind === "output")
    });
    this.renderActions(root, {
      title: "会修改原文，自动备份",
      subtitle: "执行前会保存原文备份，不满意可以找回。",
      badge: "谨慎使用",
      actions: this.plugin.settings.actions.filter((action) => action.kind === "modify")
    });
    this.renderBridge(root, file);
    this.renderPreview(root);
  }

  renderEmpty(root) {
    const panel = root.createDiv("hc-empty");
    const icon = panel.createDiv("hc-empty-icon");
    setIcon(icon, "file-text");
    panel.createEl("div", { cls: "hc-title", text: "先打开一篇 Markdown 笔记" });
    panel.createDiv({ cls: "hc-subtitle", text: "打开正文笔记后，再回到这个操作台。它会围绕当前笔记生成文章、选题、摘要，或备份后修改原文。" });
  }

  renderHeader(root) {
    const panel = root.createDiv("hc-hero");
    const left = panel.createDiv("hc-hero-copy");
    left.createDiv({ cls: "hc-kicker", text: "Hermes / Codex" });
    left.createEl("div", { cls: "hc-title", text: "当前笔记操作台" });
    left.createDiv({ cls: "hc-subtitle", text: "打开一篇笔记，点一个动作，把素材变成文章、选题、摘要或整理好的知识库条目。" });
  }

  renderControls(root) {
    const panel = root.createDiv("hc-settings");
    const toolbar = panel.createDiv("hc-control-panel");
    toolbar.createDiv({ cls: "hc-control-label", text: "运行设置" });
    const engineGroup = toolbar.createDiv("hc-control-group");
    engineGroup.createDiv({ cls: "hc-field-label", text: "引擎" });
    const engine = engineGroup.createEl("select", { cls: "hc-select" });
    for (const option of [["hermes", "Hermes"], ["codex", "Codex"]]) {
      const item = engine.createEl("option", { value: option[0], text: option[1] });
      item.selected = this.plugin.settings.engine === option[0];
    }
    engine.onchange = async () => {
      this.plugin.settings.engine = engine.value;
      await this.plugin.saveSettings();
      this.updateModelSelectState();
      new Notice(`当前引擎：${engine.value}`);
    };

    const modelGroup = toolbar.createDiv("hc-control-group hc-model-control");
    modelGroup.createDiv({ cls: "hc-field-label", text: "Hermes 模型" });
    this.modelSelectEl = modelGroup.createEl("select", { cls: "hc-select hc-model-select" });
    const modelOptions = this.plugin.getHermesModelOptions();
    for (const model of modelOptions) {
      const option = this.modelSelectEl.createEl("option", { value: model.value, text: model.label });
      option.selected = this.plugin.settings.selectedHermesModel === model.value;
    }
    if (!modelOptions.some((model) => model.value === this.plugin.settings.selectedHermesModel)) {
      this.plugin.settings.selectedHermesModel = "__default";
    }
    this.modelSelectEl.onchange = async () => {
      this.plugin.settings.selectedHermesModel = this.modelSelectEl.value;
      await this.plugin.saveSettings();
      const selected = modelOptions.find((model) => model.value === this.modelSelectEl.value);
      new Notice(`Hermes 模型：${selected ? selected.label : "默认模型"}`);
    };
    this.updateModelSelectState();

    const profileGroup = toolbar.createDiv("hc-control-group");
    profileGroup.createDiv({ cls: "hc-field-label", text: "文风" });
    const profile = profileGroup.createEl("select", { cls: "hc-select" });
    for (const item of this.plugin.settings.profiles) {
      const option = profile.createEl("option", { value: item.id, text: item.label });
      option.selected = this.plugin.settings.selectedProfileId === item.id;
    }
    profile.onchange = async () => {
      this.plugin.settings.selectedProfileId = profile.value;
      await this.plugin.saveSettings();
      new Notice("文风已切换");
    };

    const buttonGroup = toolbar.createDiv("hc-control-group hc-control-buttons");
    const refresh = toolbar.createEl("button", { cls: "hc-button", text: "刷新" });
    buttonGroup.appendChild(refresh);
    refresh.onclick = () => this.refresh();

    const openResults = toolbar.createEl("button", { cls: "hc-button", text: "结果" });
    buttonGroup.appendChild(openResults);
    openResults.onclick = () => this.plugin.openPath("AI操作台/运行结果/当前笔记/00-当前笔记说明.md");
  }

  updateModelSelectState() {
    if (!this.modelSelectEl) return;
    const isHermes = this.plugin.settings.engine === "hermes";
    this.modelSelectEl.disabled = !isHermes;
    this.modelSelectEl.toggleClass("is-disabled", !isHermes);
    this.modelSelectEl.setAttr("title", isHermes ? "当前动作会使用选中的 Hermes 模型" : "切换到 Hermes 引擎后可选择模型");
  }

  renderNote(root, file) {
    const panel = root.createDiv("hc-source");
    const top = panel.createDiv("hc-source-top");
    const lock = top.createDiv("hc-source-icon");
    setIcon(lock, "badge-check");
    const titleWrap = top.createDiv("hc-source-title-wrap");
    titleWrap.createDiv({ cls: "hc-source-label", text: "已锁定当前笔记" });
    titleWrap.createDiv({ cls: "hc-note-name", text: file.basename });
    const words = this.currentText.trim() ? this.currentText.trim().split(/\s+/).length : 0;
    const lines = this.currentText ? this.currentText.split(/\r?\n/).length : 0;
    const meta = panel.createDiv("hc-meta-grid");
    meta.createDiv({ cls: "hc-meta-item", text: file.path });
    meta.createDiv({ cls: "hc-meta-item", text: `${lines} 行` });
    meta.createDiv({ cls: "hc-meta-item", text: `约 ${words} 段/词片` });
    this.statusEl = panel.createDiv({ cls: "hc-run-status", text: "就绪" });
  }

  renderActions(root, group) {
    const panel = root.createDiv("hc-section");
    const sectionHead = panel.createDiv("hc-section-head");
    const copy = sectionHead.createDiv();
    copy.createEl("div", { cls: "hc-section-title", text: group.title });
    copy.createDiv({ cls: "hc-section-subtitle", text: group.subtitle });
    sectionHead.createDiv({ cls: "hc-section-badge", text: group.badge });
    const grid = panel.createDiv("hc-grid");
    for (const action of group.actions) {
      const card = grid.createEl("button", { cls: "hc-action" });
      card.setAttr("type", "button");
      card.setAttr("aria-label", action.label);
      const head = card.createDiv("hc-action-head");
      if (action.icon) {
        const icon = head.createDiv("hc-action-icon");
        setIcon(icon, action.icon);
      }
      const title = head.createDiv("hc-action-title");
      title.createSpan({ text: action.label });
      title.createDiv({ cls: "hc-action-kind", text: action.kind === "modify" ? "自动备份后修改" : "生成新文件" });
      const arrow = head.createDiv("hc-action-arrow");
      setIcon(arrow, "arrow-up-right");
      card.createDiv({ cls: "hc-hint", text: action.description });
      card.onclick = () => this.runAction(action);
      this.actionButtons.push(card);
    }
  }

  renderBridge(root, file) {
    const panel = root.createDiv("hc-section hc-bridge");
    const sectionHead = panel.createDiv("hc-section-head");
    const copy = sectionHead.createDiv();
    copy.createEl("div", { cls: "hc-section-title", text: "手动接管" });
    copy.createDiv({ cls: "hc-section-subtitle", text: "按钮适合固定动作；想连续追问时，把路径或提示词复制给 Hermes/Codex。" });
    const toolbar = panel.createDiv("hc-toolbar");
    this.addCopyButton(toolbar, "复制相对路径", () => file.path);
    this.addCopyButton(toolbar, "复制完整路径", () => path.join(this.plugin.getVaultRoot(), file.path));
    this.addCopyButton(toolbar, "复制改写提示词", () => this.plugin.buildManualPrompt(file.path));
    this.addOpenButton(toolbar, "打开结果", "AI操作台/运行结果/当前笔记/00-当前笔记说明.md");
    this.addOpenButton(toolbar, "打开备份", "AI操作台/备份/00-备份说明.md");
  }

  renderPreview(root) {
    const panel = root.createDiv("hc-section");
    const sectionHead = panel.createDiv("hc-section-head");
    const copy = sectionHead.createDiv();
    copy.createEl("div", { cls: "hc-section-title", text: "内容预览" });
    copy.createDiv({ cls: "hc-section-subtitle", text: "只显示前 6000 字，方便确认当前锁定的是哪篇笔记。" });
    panel.createEl("pre", { cls: "hc-preview", text: this.currentText.slice(0, 6000) || "空笔记" });
  }

  addCopyButton(parent, text, getValue) {
    const button = parent.createEl("button", { cls: "hc-button", text });
    button.onclick = async () => {
      await navigator.clipboard.writeText(getValue());
      new Notice("已复制");
    };
  }

  addOpenButton(parent, text, filePath) {
    const button = parent.createEl("button", { cls: "hc-button", text });
    button.onclick = async () => {
      await this.plugin.openPath(filePath);
    };
  }

  async runAction(action) {
    if (!this.currentFile || this.running) return;
    const profileId = action.usesProfile ? this.plugin.settings.selectedProfileId : "__none";
    const startedAt = Date.now();
    this.running = true;
    this.setButtonsDisabled(true);
    this.setStatus(`${action.label} 运行中，请稍等...`);
    try {
      const result = await this.plugin.runAction(action.id, this.currentFile.path, profileId, this.plugin.settings.selectedHermesModel);
      const seconds = Math.round((Date.now() - startedAt) / 1000);
      this.setStatus(`${action.label} 完成，用时 ${seconds}s`);
      new Notice(`${action.label} 完成`);
      const output = this.plugin.parseOutputPath(result.stdout);
      if (output && output !== this.currentFile.path) {
        await this.plugin.openPath(output);
      } else {
        await this.refresh();
      }
    } catch (error) {
      const failure = this.formatError(action.label, error.message);
      this.setStatus(failure.text, failure.logPath);
      new Notice(`${action.label} 失败，详情看操作台状态`);
    } finally {
      this.running = false;
      this.setButtonsDisabled(false);
    }
  }

  setStatus(text, logPath = "") {
    if (!this.statusEl) return;
    this.statusEl.empty();
    this.statusEl.createSpan({ text });
    if (logPath) {
      const button = this.statusEl.createEl("button", { cls: "hc-status-button", text: "打开日志" });
      button.onclick = async () => {
        await this.plugin.openPath(logPath);
      };
    }
  }

  setButtonsDisabled(disabled) {
    for (const button of this.actionButtons) {
      button.disabled = disabled;
      button.toggleClass("is-running-disabled", disabled);
    }
  }

  formatError(label, message) {
    const text = String(message || "").trim();
    const logMatch = text.match(/运行日志:\s*([^\s]+)/);
    if (text.includes("Illegal byte sequence")) {
      return { text: `${label} 失败：文件名编码问题。已修复新版命名规则，请重新运行一次。`, logPath: "" };
    }
    if (logMatch) {
      return { text: `${label} 失败：后台执行没有完成。日志：${logMatch[1]}`, logPath: logMatch[1] };
    }
    return { text: `${label} 失败：${text.split("\n").slice(-3).join(" ")}`, logPath: "" };
  }
}

module.exports = class HermesCodexNoteOpsPlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    await this.ensureVaultFiles();

    this.registerView(VIEW_TYPE, (leaf) => new NoteOpsView(leaf, this));
    this.addRibbonIcon("sparkles", "当前笔记操作台", () => this.activateView());
    this.addCommand({
      id: "open-current-note-ops",
      name: "打开当前笔记操作台",
      callback: () => this.activateView()
    });
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.settings.selectedHermesModel = this.settings.selectedHermesModel || DEFAULT_SETTINGS.selectedHermesModel;
    if (this.settings.actions && this.settings.actions.length) {
      for (const defAction of DEFAULT_SETTINGS.actions) {
        if (!this.settings.actions.some(a => a.id === defAction.id)) {
          this.settings.actions.push(defAction);
        }
      }
    } else {
      this.settings.actions = DEFAULT_SETTINGS.actions;
    }
    this.settings.profiles = this.settings.profiles && this.settings.profiles.length ? this.settings.profiles : DEFAULT_SETTINGS.profiles;
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  getSourceFile() {
    const active = this.app.workspace.getActiveFile();
    const excludedDirs = [
      this.settings.resultsDir,
      this.settings.backupDir,
      "AI操作台/运行日志"
    ].map((dir) => dir.replace(/\/+$/, "") + "/");
    const isGeneratedFile = (file) => excludedDirs.some((dir) => file.path.startsWith(dir));
    if (active instanceof TFile && active.extension === "md" && !isGeneratedFile(active)) {
      this.sourcePath = active.path;
      return active;
    }
    if (this.sourcePath) {
      const file = this.app.vault.getAbstractFileByPath(this.sourcePath);
      if (file instanceof TFile) return file;
    }
    return null;
  }

  async activateView() {
    let leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    if (!leaves.length) {
      await this.app.workspace.getLeaf(true).setViewState({ type: VIEW_TYPE, active: true });
      leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    }
    if (leaves[0]) this.app.workspace.revealLeaf(leaves[0]);
  }

  getHermesModelOptions() {
    const options = [{ value: "__default", label: "默认模型（Hermes 当前配置）" }];
    const seen = new Set(options.map((option) => option.value));
    const add = (provider, model, name = "") => {
      if (!provider || !model) return;
      const value = `${provider}|${model}`;
      if (seen.has(value)) return;
      seen.add(value);
      options.push({
        value,
        label: name && name !== model ? `${name} · ${provider}/${model}` : `${provider}/${model}`
      });
    };

    try {
      const modelsPath = path.join(os.homedir(), ".hermes", "models.json");
      if (fs.existsSync(modelsPath)) {
        const models = JSON.parse(fs.readFileSync(modelsPath, "utf8"));
        if (Array.isArray(models)) {
          for (const item of models) {
            add(item.provider, item.model, item.name);
          }
        }
      }
    } catch (error) {
      console.warn("Hermes Codex Note Ops: failed to read Hermes models.json", error);
    }

    try {
      const configPath = path.join(os.homedir(), ".hermes", "config.yaml");
      if (fs.existsSync(configPath)) {
        const text = fs.readFileSync(configPath, "utf8");
        const defaultModel = text.match(/model:\s*\n(?:[ \t]+[^\n]*\n)*?[ \t]+default:\s*["']?([^"'\n]+)["']?/);
        const defaultProvider = text.match(/model:\s*\n(?:[ \t]+[^\n]*\n)*?[ \t]+provider:\s*["']?([^"'\n]+)["']?/);
        if (defaultProvider && defaultModel) add(defaultProvider[1].trim(), defaultModel[1].trim(), "当前默认");
        for (const match of text.matchAll(/-\s*provider:\s*["']?([^"'\n]+)["']?\s*\n[ \t]+model:\s*["']?([^"'\n]+)["']?/g)) {
          add(match[1].trim(), match[2].trim(), "Fallback");
        }
      }
    } catch (error) {
      console.warn("Hermes Codex Note Ops: failed to read Hermes config.yaml", error);
    }

    return options;
  }

  runAction(actionId, notePath, profileId, hermesModelSpec) {
    const vaultRoot = this.getVaultRoot();
    const scriptPath = path.join(vaultRoot, SCRIPT_PATH);
    const timeout = Math.max(1, Number(this.settings.actionTimeoutMinutes || 30)) * 60 * 1000;
    const cliPath = [
      path.join(os.homedir(), ".local/bin"),
      "/usr/local/bin",
      "/opt/homebrew/bin",
      "/usr/bin",
      "/bin",
      "/usr/sbin",
      "/sbin"
    ].join(":");
    return new Promise((resolve, reject) => {
      execFile("/bin/bash", [scriptPath, actionId, notePath, profileId, this.settings.engine, hermesModelSpec || "__default"], {
        cwd: vaultRoot,
        timeout,
        env: { ...process.env, PATH: `${cliPath}:${process.env.PATH || ""}` }
      }, (error, stdout, stderr) => {
        if (error) {
          const detail = stderr || stdout || error.message;
          reject(new Error(detail.trim()));
          return;
        }
        resolve({ stdout, stderr });
      });
    });
  }

  parseOutputPath(stdout) {
    const match = String(stdout || "").match(/^OUTPUT:(.+)$/m);
    return match ? match[1].trim() : "";
  }

  async openPath(filePath) {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (file instanceof TFile) {
      await this.app.workspace.getLeaf(true).openFile(file);
    }
  }

  buildManualPrompt(notePath) {
    return [
      `请读取 Obsidian 当前笔记：${notePath}`,
      "",
      "先判断这篇笔记适合做什么内容，然后给我：",
      "1. 公众号文章方向",
      "2. 小红书拆条方向",
      "3. 可补充的标签和双链",
      "4. 下一步我应该做什么",
      "",
      "不要编造原文没有的事实。"
    ].join("\n");
  }

  async ensureVaultFiles() {
    const vaultRoot = this.getVaultRoot();
    for (const dir of [
      SETTINGS_DIR,
      `${SETTINGS_DIR}/actions`,
      `${SETTINGS_DIR}/profiles`,
      `${SETTINGS_DIR}/scripts`,
      this.settings.resultsDir,
      this.settings.backupDir,
      "AI操作台/运行日志",
      "AI操作台/资料入口",
      "AI操作台/失败空文件归档"
    ]) {
      fs.mkdirSync(path.join(vaultRoot, dir), { recursive: true });
    }
    this.ensureReadme(this.settings.resultsDir, [
      "# 当前笔记运行结果",
      "",
      "这里保存操作台生成的新文件。",
      "",
      "- 输出动作会写到这里。",
      "- 文件名包含动作、时间、运行进程 ID 和源笔记 hash，避免并发覆盖。",
      "- 每个结果末尾会记录源笔记和运行日志路径。"
    ].join("\n"));
    this.ensureReadme(this.settings.backupDir, [
      "# 操作台备份",
      "",
      "这里保存会修改原文的动作在执行前创建的备份。",
      "",
      "如果润色或补标签不满意，可以从这里找回原文版本。"
    ].join("\n"));
  }

  ensureReadme(dir, content) {
    const vaultRoot = this.getVaultRoot();
    const names = {
      [this.settings.resultsDir]: "00-当前笔记说明.md",
      [this.settings.backupDir]: "00-备份说明.md",
      "AI操作台/资料入口": "00-资料入口说明.md"
    };
    const readmePath = path.join(vaultRoot, dir, names[dir] || "README.md");
    if (!fs.existsSync(readmePath)) {
      fs.writeFileSync(readmePath, content + "\n", "utf8");
    }
  }

  getVaultRoot() {
    const adapter = this.app.vault.adapter;
    if (adapter && adapter.basePath) return adapter.basePath;
    return path.dirname(this.app.vault.configDir || ".");
  }
};
