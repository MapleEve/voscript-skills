#!/usr/bin/env node
/**
 * VoScript Skills installer
 *
 * Copies the voscript-api skill to a target AI agent's skills directory.
 * Supports the full Vercel skills agent target list, plus custom directories.
 *
 * Usage:
 *   npx voscript-skills                       # interactive
 *   npx voscript-skills --agent <name>        # see --help for names
 *   npx voscript-skills update --agent <name> # reinstall current package over old copy
 *   npx voscript-skills --dir /custom/path
 *   npx voscript-skills --all                 # all detected agents
 *   npx voscript-skills --uninstall
 *   npx voscript-skills --lang zh|en
 *   npx voscript-skills --yes | -y
 */

"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const readline = require("readline");

// ─── Language detection ──────────────────────────────────────────────────────

function detectLang() {
  const lang =
    process.env.LANG || process.env.LANGUAGE || process.env.LC_ALL || "";
  if (/zh/i.test(lang)) return "zh";
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || "";
    if (/^zh/i.test(locale)) return "zh";
  } catch (_) {
    /* ignore */
  }
  return "en";
}

// ─── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0] && !args[0].startsWith("-") ? args[0] : "install";
const optionArgs = command === "install" ? args : args.slice(1);

function hasFlag(...names) {
  return names.some((n) => optionArgs.includes(n));
}
function getOpt(name) {
  const i = optionArgs.indexOf(name);
  if (i === -1) return null;
  return optionArgs[i + 1] || null;
}

const uninstall = hasFlag("--uninstall", "-u");
const installAll = hasFlag("--all");
const skipConfirm = hasFlag("--yes", "-y");
const agentFlag = getOpt("--agent");
const customDir = getOpt("--dir");
const langOverride = getOpt("--lang");
const showHelp = hasFlag("--help", "-h");
const isUpdate = command === "update" || command === "upgrade" || hasFlag("--update");

const LANG =
  langOverride === "zh" || langOverride === "en" ? langOverride : detectLang();

// ─── i18n ────────────────────────────────────────────────────────────────────

const MSG = {
  zh: {
    title: "VoScript Skills 安装程序",
    detectedHeader: "检测到以下 AI 代理环境：",
    detectedYes: "✓ 已检测到",
    detectedNo: "未检测到",
    optCustom: "自定义路径...",
    optExit: "退出",
    selectPrompt: "请选择安装目标",
    customPathPrompt: "请输入自定义 skills 目录路径",
    confirmInstall: "确认安装到",
    confirmYes: "y",
    confirmNo: "n",
    yesNoHint: "[y/N]",
    cancelled: "已取消。",
    exiting: "已退出。",
    bye: "再见。",
    invalidChoice: "无效的选项，请重试。",
    srcNotFound: "错误：未找到 skill 源目录：",
    noWritePermission: "错误：没有写入权限：",
    permissionHint: "请检查目录权限，或使用 sudo / 更换目录后重试。",
    installing: "正在安装…",
    installed: "✅ 安装完成！",
    updated: "✅ 已更新！",
    uninstalling: "正在卸载…",
    uninstalled: "✓ 已卸载：",
    notInstalled: "未安装：",
    installPath: "安装路径",
    configSteps: "配置步骤：",
    cfg1: "设置服务地址：export VOSCRIPT_URL=http://localhost:8780",
    cfg2: "设置 API Key：export VOSCRIPT_API_KEY=your_key",
    verify: "验证安装：",
    docs: "文档",
    issues: "反馈",
    agent_custom: "自定义路径",
    noAgentDetected:
      "未检测到任何已知的 AI 代理环境。您可以选择自定义路径或退出。",
    installAllStart: "将对所有检测到的代理环境执行安装：",
    summaryHeader: "安装汇总：",
    summaryOk: "成功",
    summaryFail: "失败",
    helpText: [
      "用法：",
      "  npx voscript-skills                     交互式安装",
      "  npx voscript-skills --agent <name>      指定代理（见下方代理名称）",
      "  npx voscript-skills update --agent <name> 更新指定代理",
      "  npx voscript-skills update --all        更新所有已检测到的代理",
      "  npx voscript-skills --dir <path>        指定自定义目录（可配合 --agent 写入元数据）",
      "  npx voscript-skills --all               为所有已检测到的代理安装",
      "  npx voscript-skills --uninstall         卸载",
      "  npx voscript-skills --lang zh|en        覆盖语言检测",
      "  npx voscript-skills --yes, -y           跳过确认",
      "  npx voscript-skills --help, -h          显示本帮助",
      "",
      "支持 Vercel skills 当前列出的全部代理；见下方自动生成列表。",
    ].join("\n"),
  },
  en: {
    title: "VoScript Skills Installer",
    detectedHeader: "Detected AI agent environments:",
    detectedYes: "✓ detected",
    detectedNo: "not detected",
    optCustom: "Custom path...",
    optExit: "Exit",
    selectPrompt: "Select installation target",
    customPathPrompt: "Enter custom skills directory path",
    confirmInstall: "Install to",
    confirmYes: "y",
    confirmNo: "n",
    yesNoHint: "[y/N]",
    cancelled: "Cancelled.",
    exiting: "Exiting.",
    bye: "Goodbye.",
    invalidChoice: "Invalid choice, please try again.",
    srcNotFound: "Error: skill source not found at ",
    noWritePermission: "Error: no write permission for ",
    permissionHint:
      "Check directory permissions, or retry with sudo / a different directory.",
    installing: "Installing...",
    installed: "✅ Installed successfully!",
    updated: "✅ Updated successfully!",
    uninstalling: "Uninstalling...",
    uninstalled: "✓ Uninstalled: ",
    notInstalled: "Not installed: ",
    installPath: "Install path",
    configSteps: "Configuration steps:",
    cfg1: "Set service URL: export VOSCRIPT_URL=http://localhost:8780",
    cfg2: "Set API key: export VOSCRIPT_API_KEY=your_key",
    verify: "Verify installation:",
    docs: "Docs",
    issues: "Issues",
    agent_custom: "Custom path",
    noAgentDetected:
      "No known AI agent environment detected. You may pick a custom path or exit.",
    installAllStart: "Installing for all detected agents:",
    summaryHeader: "Installation summary:",
    summaryOk: "ok",
    summaryFail: "failed",
    helpText: [
      "Usage:",
      "  npx voscript-skills                     interactive install",
      "  npx voscript-skills --agent <name>      target agent (see names below)",
      "  npx voscript-skills update --agent <name> update a target agent",
      "  npx voscript-skills update --all        update every detected agent",
      "  npx voscript-skills --dir <path>        custom directory (may be combined with --agent metadata)",
      "  npx voscript-skills --all               install for every detected agent",
      "  npx voscript-skills --uninstall         uninstall",
      "  npx voscript-skills --lang zh|en        override language",
      "  npx voscript-skills --yes, -y           skip confirmation prompts",
      "  npx voscript-skills --help, -h          show this help",
      "",
      "Supports every agent currently listed by Vercel skills; see generated list below.",
    ].join("\n"),
  },
};

function t(key) {
  return (MSG[LANG] && MSG[LANG][key]) || MSG.en[key] || key;
}

// ─── Agent definitions ───────────────────────────────────────────────────────

const HOME = os.homedir();
const IS_WIN = process.platform === "win32";
const APPDATA = process.env.APPDATA || path.join(HOME, "AppData", "Roaming");

function homePath(...parts) {
  return path.join(HOME, ...parts);
}

function agent(id, label, homeParts, aliases = []) {
  const root = homePath(...homeParts.slice(0, -1));
  const skillsDir = homePath(...homeParts);
  return { id, label, aliases, detectDir: root, skillsDir };
}

// Canonical ids and paths follow Vercel Labs `skills` README supported agents.
// Old VoScript ids are kept as aliases where they existed before.
const AGENTS = [
  agent("amp", "Amp", [".config", "agents", "skills"]),
  agent("kimi-cli", "Kimi Code CLI", [".config", "agents", "skills"]),
  agent("replit", "Replit", [".config", "agents", "skills"]),
  agent("universal", "Universal", [".config", "agents", "skills"]),
  agent("antigravity", "Antigravity", [".gemini", "antigravity", "skills"]),
  agent("augment", "Augment", [".augment", "skills"]),
  agent("bob", "IBM Bob", [".bob", "skills"]),
  agent("claude-code", "Claude Code", [".claude", "skills"], ["claude"]),
  agent("openclaw", "OpenClaw", [".openclaw", "skills"]),
  agent("cline", "Cline", [".agents", "skills"]),
  agent("warp", "Warp", [".agents", "skills"]),
  agent("codebuddy", "CodeBuddy", [".codebuddy", "skills"]),
  agent("codex", "OpenAI Codex CLI", [".codex", "skills"]),
  agent("command-code", "Command Code", [".commandcode", "skills"]),
  agent("continue", "Continue", [".continue", "skills"]),
  agent("cortex", "Cortex Code", [".snowflake", "cortex", "skills"]),
  agent("crush", "Crush", [".config", "crush", "skills"]),
  agent("cursor", "Cursor", [".cursor", "skills"]),
  agent("deepagents", "Deep Agents", [".deepagents", "agent", "skills"]),
  agent("droid", "Droid", [".factory", "skills"]),
  agent("firebender", "Firebender", [".firebender", "skills"]),
  agent("gemini-cli", "Gemini CLI", [".gemini", "skills"], ["gemini"]),
  agent("hermes", "Hermes", [".hermes", "skills"]),
  agent("github-copilot", "GitHub Copilot", [".copilot", "skills"]),
  agent("goose", "Goose", [".config", "goose", "skills"]),
  agent("junie", "Junie", [".junie", "skills"]),
  agent("iflow-cli", "iFlow CLI", [".iflow", "skills"]),
  agent("kilo", "Kilo Code", [".kilocode", "skills"]),
  agent("kiro-cli", "Kiro CLI", [".kiro", "skills"]),
  agent("kode", "Kode", [".kode", "skills"]),
  agent("mcpjam", "MCPJam", [".mcpjam", "skills"]),
  agent("mistral-vibe", "Mistral Vibe", [".vibe", "skills"]),
  agent("mux", "Mux", [".mux", "skills"]),
  agent("opencode", "OpenCode", [".config", "opencode", "skills"]),
  agent("openhands", "OpenHands", [".openhands", "skills"]),
  agent("pi", "Pi", [".pi", "agent", "skills"]),
  agent("qoder", "Qoder", [".qoder", "skills"]),
  agent("qwen-code", "Qwen Code", [".qwen", "skills"], ["qwen"]),
  agent("roo", "Roo Code", [".roo", "skills"]),
  agent("trae", "Trae", [".trae", "skills"]),
  agent("trae-cn", "Trae CN", [".trae-cn", "skills"]),
  agent("windsurf", "Windsurf", [".codeium", "windsurf", "skills"]),
  agent("zencoder", "Zencoder", [".zencoder", "skills"]),
  agent("neovate", "Neovate", [".neovate", "skills"]),
  agent("pochi", "Pochi", [".pochi", "skills"]),
  agent("adal", "AdaL", [".adal", "skills"]),
];

function prettyPath(p) {
  if (!p) return p;
  if (!IS_WIN && p.startsWith(HOME)) return "~" + p.slice(HOME.length);
  return p;
}

function detectAgents() {
  return AGENTS.map((a) => ({
    ...a,
    detected: safeIsDir(a.detectDir),
  }));
}

function safeIsDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch (_) {
    return false;
  }
}

// ─── Paths ───────────────────────────────────────────────────────────────────

const skillName = "voscript-api";
const pkgRoot = path.join(__dirname, "..");
const srcDir = path.join(pkgRoot, skillName);
const pkg = JSON.parse(
  fs.readFileSync(path.join(pkgRoot, "package.json"), "utf8")
);
const skillMeta = JSON.parse(
  fs.readFileSync(path.join(srcDir, ".meta.json"), "utf8")
);

// ─── FS helpers ──────────────────────────────────────────────────────────────

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

function writeInstallMetadata(destDir, agentId, mode) {
  const metadata = {
    package: {
      name: pkg.name,
      version: pkg.version,
    },
    skill: {
      id: skillMeta.skill_id || skillName,
      name: skillName,
    },
    agent: agentId || "custom",
    installedAt: new Date().toISOString(),
    mode,
  };
  fs.writeFileSync(
    path.join(destDir, ".install.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8"
  );
}

function removeDirRecursive(dir) {
  if (!fs.existsSync(dir)) return;
  if (typeof fs.rmSync === "function") {
    fs.rmSync(dir, { recursive: true, force: true });
    return;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) removeDirRecursive(p);
    else fs.unlinkSync(p);
  }
  fs.rmdirSync(dir);
}

function canWriteTo(dir) {
  let current = dir;
  while (current && !fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  try {
    fs.accessSync(current, fs.constants.W_OK);
    return true;
  } catch (_) {
    return false;
  }
}

// ─── Interactive prompt ──────────────────────────────────────────────────────

function prompt(question, defaultValue) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const suffix = defaultValue !== undefined ? ` [${defaultValue}]` : "";
    rl.question(`${question}${suffix}: `, (answer) => {
      rl.close();
      const trimmed = (answer || "").trim();
      resolve(
        trimmed === "" && defaultValue !== undefined
          ? String(defaultValue)
          : trimmed
      );
    });
  });
}

async function confirm(question) {
  if (skipConfirm) return true;
  const ans = await prompt(`${question} ${t("yesNoHint")}`, t("confirmNo"));
  return /^y(es)?$/i.test(ans);
}

// ─── Install / uninstall ops ─────────────────────────────────────────────────

function installOne(skillsRoot, agentId, mode) {
  const destDir = path.join(skillsRoot, skillName);

  if (!fs.existsSync(srcDir)) {
    const err = new Error(`${t("srcNotFound")}${srcDir}`);
    err.userMessage = true;
    throw err;
  }

  if (!canWriteTo(destDir)) {
    const err = new Error(
      `${t("noWritePermission")}${prettyPath(skillsRoot)}\n  ${t("permissionHint")}`
    );
    err.userMessage = true;
    throw err;
  }

  const existed = fs.existsSync(destDir);
  copyDirRecursive(srcDir, destDir);
  writeInstallMetadata(destDir, agentId, mode || (existed ? "update" : "install"));
  return { destDir, existed };
}

function uninstallOne(skillsRoot) {
  const destDir = path.join(skillsRoot, skillName);
  if (!fs.existsSync(destDir)) {
    return { destDir, removed: false };
  }
  removeDirRecursive(destDir);
  return { destDir, removed: true };
}

// ─── Output templates ────────────────────────────────────────────────────────

function printHeader() {
  console.log("");
  console.log(t("title"));
  console.log("");
}

function printPostInstall(destDir, mode) {
  const p = prettyPath(destDir);
  console.log("");
  console.log(mode === "update" ? t("updated") : t("installed"));
  console.log("");
  console.log(`  ${t("installPath")}: ${p}/`);
  console.log("");
  console.log(t("configSteps"));
  console.log(`  1. ${t("cfg1")}`);
  console.log(`  2. ${t("cfg2")}`);
  console.log("");
  console.log(`${t("verify")}`);
  console.log(`  ls ${p}/SKILL.md`);
  console.log("");
  console.log(`${t("docs")}: https://github.com/MapleEve/voscript-skills`);
  console.log(`${t("issues")}: https://github.com/MapleEve/VoScript/issues`);
  console.log("");
}

// ─── Flows ───────────────────────────────────────────────────────────────────

function padRight(s, n) {
  if (s.length >= n) return s;
  return s + " ".repeat(n - s.length);
}

function expandHome(p) {
  if (!p) return p;
  if (p === "~") return HOME;
  if (p.startsWith("~/") || p.startsWith("~\\")) {
    return path.join(HOME, p.slice(2));
  }
  return p;
}

function resolveAgent(agentId) {
  return AGENTS.find((x) => x.id === agentId || x.aliases.includes(agentId));
}

function resolveAgentDir(agentId) {
  const a = resolveAgent(agentId);
  return a ? a.skillsDir : null;
}

function formatAgentHelp() {
  return AGENTS.map((a) => {
    const aliasText = a.aliases.length ? `  aliases: ${a.aliases.join(", ")}` : "";
    return `  ${padRight(a.id, 15)} ${padRight(a.label, 24)} ${prettyPath(a.skillsDir)}/${aliasText}`;
  }).join("\n");
}

async function runInteractive() {
  printHeader();
  console.log(t("detectedHeader"));

  const detected = detectAgents();
  const menu = [];
  let idx = 1;
  for (const a of detected) {
    menu.push({
      index: idx++,
      agent: a,
      label: a.label,
      dir: a.skillsDir,
      detected: a.detected,
    });
  }
  const customIndex = idx++;
  const exitIndex = 0;

  for (const item of menu) {
    const mark = item.detected ? t("detectedYes") : t("detectedNo");
    console.log(
      `  [${item.index}] ${padRight(item.label, 18)} (${prettyPath(item.dir)}/)  ${mark}`
    );
  }
  console.log(`  [${customIndex}] ${t("optCustom")}`);
  console.log(`  [${exitIndex}] ${t("optExit")}`);
  console.log("");

  const firstDetected = menu.find((m) => m.detected);
  const defaultChoice = firstDetected
    ? firstDetected.index
    : menu[0]
      ? menu[0].index
      : customIndex;

  if (!detected.some((a) => a.detected)) {
    console.log(t("noAgentDetected"));
    console.log("");
  }

  const answer = await prompt(t("selectPrompt"), defaultChoice);
  const choice = parseInt(answer, 10);

  if (choice === exitIndex) {
    console.log(t("bye"));
    process.exit(0);
  }

  let targetDir = null;
  let targetAgentId = "custom";
  const picked = menu.find((m) => m.index === choice);
  if (picked) {
    targetDir = picked.dir;
    targetAgentId = picked.agent.id;
  } else if (choice === customIndex) {
    const cp = await prompt(t("customPathPrompt"), path.join(HOME, "skills"));
    if (!cp) {
      console.log(t("cancelled"));
      process.exit(0);
    }
    targetDir = expandHome(cp);
  } else {
    console.log(t("invalidChoice"));
    process.exit(1);
  }

  const ok = await confirm(
    `${t("confirmInstall")} ${prettyPath(path.join(targetDir, skillName))}?`
  );
  if (!ok) {
    console.log(t("cancelled"));
    process.exit(0);
  }

  console.log(isUpdate ? (LANG === "zh" ? "正在更新…" : "Updating...") : t("installing"));
  try {
    const { destDir } = installOne(targetDir, targetAgentId, isUpdate ? "update" : "install");
    printPostInstall(destDir, isUpdate ? "update" : "install");
  } catch (e) {
    console.error(e.userMessage ? e.message : e.stack || e.message);
    process.exit(1);
  }
}

async function runNonInteractive() {
  let targets = [];

  if (installAll) {
    const detected = detectAgents().filter((a) => a.detected);
    if (detected.length === 0) {
      console.error(t("noAgentDetected"));
      process.exit(1);
    }
    targets = detected.map((a) => ({
      label: a.label,
      dir: a.skillsDir,
      agentId: a.id,
    }));
  } else if (customDir) {
    const agent = agentFlag && agentFlag !== "custom" ? resolveAgent(agentFlag) : null;
    if (agentFlag && agentFlag !== "custom" && !agent) {
      console.error(
        (LANG === "zh" ? "未知代理：" : "Unknown agent: ") + agentFlag
      );
      process.exit(1);
    }
    targets = [
      {
        label: agent ? agent.label : t("agent_custom"),
        dir: expandHome(customDir),
        agentId: agent ? agent.id : "custom",
      },
    ];
  } else if (agentFlag) {
    if (agentFlag === "custom") {
      console.error(
        LANG === "zh"
          ? "--agent custom 需同时提供 --dir <path>"
          : "--agent custom requires --dir <path>"
      );
      process.exit(1);
    }
    const a = resolveAgent(agentFlag);
    if (!a) {
      console.error(
        (LANG === "zh" ? "未知代理：" : "Unknown agent: ") + agentFlag
      );
      process.exit(1);
    }
    targets = [{ label: a.label, dir: a.skillsDir, agentId: a.id }];
  } else {
    return runInteractive();
  }

  if (uninstall) {
    console.log(t("uninstalling"));
    for (const tgt of targets) {
      try {
        const { destDir, removed } = uninstallOne(tgt.dir);
        if (removed) {
          console.log(`${t("uninstalled")}${prettyPath(destDir)}`);
        } else {
          console.log(`${t("notInstalled")}${prettyPath(destDir)}`);
        }
      } catch (e) {
        console.error(e.userMessage ? e.message : e.message);
      }
    }
    return;
  }

  if (targets.length > 1) {
    console.log(t("installAllStart"));
    for (const tgt of targets) {
      console.log(`  - ${tgt.label}  (${prettyPath(tgt.dir)}/)`);
    }
    console.log("");
  }

  const ok = skipConfirm
    ? true
    : await confirm(
        targets.length === 1
          ? `${t("confirmInstall")} ${prettyPath(path.join(targets[0].dir, skillName))}?`
          : t("installAllStart")
      );
  if (!ok) {
    console.log(t("cancelled"));
    process.exit(0);
  }

  const results = [];
  for (const tgt of targets) {
    try {
      const { destDir } = installOne(
        tgt.dir,
        tgt.agentId,
        isUpdate ? "update" : "install"
      );
      results.push({ label: tgt.label, destDir, ok: true });
    } catch (e) {
      results.push({
        label: tgt.label,
        destDir: tgt.dir,
        ok: false,
        error: e.userMessage ? e.message : e.message,
      });
    }
  }

  if (results.length === 1 && results[0].ok) {
    printPostInstall(results[0].destDir, isUpdate ? "update" : "install");
    return;
  }

  console.log("");
  console.log(t("summaryHeader"));
  for (const r of results) {
    const tag = r.ok ? t("summaryOk") : t("summaryFail");
    console.log(
      `  [${tag}] ${r.label} → ${prettyPath(r.destDir)}` +
        (r.ok ? "" : `\n         ${r.error}`)
    );
  }
  if (results.every((r) => r.ok)) {
    printPostInstall(results[0].destDir, isUpdate ? "update" : "install");
  } else {
    process.exit(1);
  }
}

// ─── Entry ───────────────────────────────────────────────────────────────────

(async function main() {
  if (showHelp) {
    printHeader();
    console.log(t("helpText"));
    console.log("");
    console.log(LANG === "zh" ? "完整代理列表：" : "Full agent list:");
    console.log(formatAgentHelp());
    process.exit(0);
  }

  if (!["install", "update", "upgrade"].includes(command)) {
    console.error(
      LANG === "zh"
        ? `未知命令：${command}`
        : `Unknown command: ${command}`
    );
    process.exit(1);
  }

  if (uninstall && !agentFlag && !customDir && !installAll) {
    printHeader();
    const detected = detectAgents();
    const candidates = detected
      .map((a) => ({
        label: a.label,
        dir: a.skillsDir,
        installed: fs.existsSync(path.join(a.skillsDir, skillName)),
      }))
      .filter((c) => c.installed);

    if (candidates.length === 0) {
      console.log(
        LANG === "zh"
          ? "未找到已安装的 voscript-api skill。"
          : "No installed voscript-api skill found."
      );
      process.exit(0);
    }

    console.log(
      LANG === "zh" ? "找到以下已安装位置：" : "Found installations at:"
    );
    let i = 1;
    for (const c of candidates) {
      console.log(`  [${i++}] ${c.label}  (${prettyPath(c.dir)}/)`);
    }
    console.log(`  [0] ${t("optExit")}`);
    console.log("");

    const ans = await prompt(t("selectPrompt"), 1);
    const idx2 = parseInt(ans, 10);
    if (idx2 === 0) {
      console.log(t("bye"));
      process.exit(0);
    }
    const pick = candidates[idx2 - 1];
    if (!pick) {
      console.log(t("invalidChoice"));
      process.exit(1);
    }
    const ok = await confirm(
      (LANG === "zh" ? "确认卸载 " : "Uninstall ") +
        prettyPath(path.join(pick.dir, skillName)) +
        "?"
    );
    if (!ok) {
      console.log(t("cancelled"));
      process.exit(0);
    }
    const { destDir, removed } = uninstallOne(pick.dir);
    if (removed) console.log(`${t("uninstalled")}${prettyPath(destDir)}`);
    else console.log(`${t("notInstalled")}${prettyPath(destDir)}`);
    return;
  }

  try {
    await runNonInteractive();
  } catch (e) {
    console.error(e.userMessage ? e.message : e.stack || e.message);
    process.exit(1);
  }
})();
