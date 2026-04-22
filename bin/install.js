#!/usr/bin/env node
/**
 * VoScript Skills installer
 *
 * Copies the voscript-api skill to a target AI agent's skills directory.
 * Supports Claude Code, Trae, Cursor, OpenAI Codex, Gemini CLI, Hermes,
 * OpenClaw, Windsurf, Cline, Roo Code, CodeBuddy (腾讯云), Qwen Code (通义), and custom directories.
 *
 * Usage:
 *   npx voscript-skills                       # interactive
 *   npx voscript-skills --agent <name>        # see --help for names
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

function hasFlag(...names) {
  return names.some((n) => args.includes(n));
}
function getOpt(name) {
  const i = args.indexOf(name);
  if (i === -1) return null;
  return args[i + 1] || null;
}

const uninstall = hasFlag("--uninstall", "-u");
const installAll = hasFlag("--all");
const skipConfirm = hasFlag("--yes", "-y");
const agentFlag = getOpt("--agent");
const customDir = getOpt("--dir");
const langOverride = getOpt("--lang");
const showHelp = hasFlag("--help", "-h");

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
    cfg1: "设置服务地址：export VOSCRIPT_URL=http://localhost:7880",
    cfg2: "设置 API Key：export VOSCRIPT_API_KEY=your_key",
    verify: "验证安装：",
    docs: "文档",
    issues: "反馈",
    agent_claude: "Claude Code",
    agent_trae: "Trae",
    agent_cursor: "Cursor",
    agent_codex: "OpenAI Codex CLI",
    agent_gemini: "Gemini CLI",
    agent_hermes: "Hermes",
    agent_openclaw: "OpenClaw",
    agent_windsurf: "Windsurf",
    agent_cline: "Cline",
    agent_roo: "Roo Code",
    agent_codebuddy: "CodeBuddy (腾讯云)",
    agent_qwen: "Qwen Code (通义)",
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
      "  npx voscript-skills --dir <path>        指定自定义目录（覆盖 --agent）",
      "  npx voscript-skills --all               为所有已检测到的代理安装",
      "  npx voscript-skills --uninstall         卸载",
      "  npx voscript-skills --lang zh|en        覆盖语言检测",
      "  npx voscript-skills --yes, -y           跳过确认",
      "  npx voscript-skills --help, -h          显示本帮助",
      "",
      "支持的代理名称（--agent）：",
      "  claude      Claude Code       (~/.claude/skills/)",
      "  trae        Trae              (~/.trae/context/skills/)",
      "  cursor      Cursor            (~/.cursor/rules/skills/)",
      "  codex       OpenAI Codex CLI  (~/.codex/skills/)",
      "  gemini      Gemini CLI        (~/.gemini/skills/)",
      "  hermes      Hermes            (~/.hermes/skills/)",
      "  openclaw    OpenClaw          (~/.openclaw/skills/)",
      "  windsurf    Windsurf          (~/.codeium/windsurf/skills/)",
      "  cline       Cline             (~/.cline/skills/)",
      "  roo         Roo Code          (~/.roo/skills/)",
      "  codebuddy   CodeBuddy 腾讯云   (~/.codebuddy/skills/)",
      "  qwen        Qwen Code 通义     (~/.qwen/skills/)",
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
    cfg1: "Set service URL: export VOSCRIPT_URL=http://localhost:7880",
    cfg2: "Set API key: export VOSCRIPT_API_KEY=your_key",
    verify: "Verify installation:",
    docs: "Docs",
    issues: "Issues",
    agent_claude: "Claude Code",
    agent_trae: "Trae",
    agent_cursor: "Cursor",
    agent_codex: "OpenAI Codex CLI",
    agent_gemini: "Gemini CLI",
    agent_hermes: "Hermes",
    agent_openclaw: "OpenClaw",
    agent_windsurf: "Windsurf",
    agent_cline: "Cline",
    agent_roo: "Roo Code",
    agent_codebuddy: "CodeBuddy",
    agent_qwen: "Qwen Code",
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
      "  npx voscript-skills --dir <path>        custom directory (overrides --agent)",
      "  npx voscript-skills --all               install for every detected agent",
      "  npx voscript-skills --uninstall         uninstall",
      "  npx voscript-skills --lang zh|en        override language",
      "  npx voscript-skills --yes, -y           skip confirmation prompts",
      "  npx voscript-skills --help, -h          show this help",
      "",
      "Supported agent names (--agent):",
      "  claude      Claude Code       (~/.claude/skills/)",
      "  trae        Trae              (~/.trae/context/skills/)",
      "  cursor      Cursor            (~/.cursor/rules/skills/)",
      "  codex       OpenAI Codex CLI  (~/.codex/skills/)",
      "  gemini      Gemini CLI        (~/.gemini/skills/)",
      "  hermes      Hermes            (~/.hermes/skills/)",
      "  openclaw    OpenClaw          (~/.openclaw/skills/)",
      "  windsurf    Windsurf          (~/.codeium/windsurf/skills/)",
      "  cline       Cline             (~/.cline/skills/)",
      "  roo         Roo Code          (~/.roo/skills/)",
      "  codebuddy   CodeBuddy         (~/.codebuddy/skills/)",
      "  qwen        Qwen Code         (~/.qwen/skills/)",
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

// Each agent: id, labelKey, detectDir (presence check), skillsDir (install target).
const AGENTS = [
  {
    id: "claude",
    labelKey: "agent_claude",
    detectDir: IS_WIN ? path.join(APPDATA, "Claude") : path.join(HOME, ".claude"),
    skillsDir: IS_WIN
      ? path.join(APPDATA, "Claude", "skills")
      : path.join(HOME, ".claude", "skills"),
  },
  {
    id: "trae",
    labelKey: "agent_trae",
    detectDir: IS_WIN ? path.join(APPDATA, "Trae") : path.join(HOME, ".trae"),
    skillsDir: IS_WIN
      ? path.join(APPDATA, "Trae", "context", "skills")
      : path.join(HOME, ".trae", "context", "skills"),
  },
  {
    id: "cursor",
    labelKey: "agent_cursor",
    detectDir: IS_WIN ? path.join(APPDATA, "Cursor") : path.join(HOME, ".cursor"),
    skillsDir: IS_WIN
      ? path.join(APPDATA, "Cursor", "rules", "skills")
      : path.join(HOME, ".cursor", "rules", "skills"),
  },
  {
    id: "codex",
    labelKey: "agent_codex",
    detectDir: IS_WIN ? path.join(HOME, ".codex") : path.join(HOME, ".codex"),
    skillsDir: IS_WIN
      ? path.join(HOME, ".codex", "skills")
      : path.join(HOME, ".codex", "skills"),
  },
  {
    id: "gemini",
    labelKey: "agent_gemini",
    detectDir: IS_WIN ? path.join(HOME, ".gemini") : path.join(HOME, ".gemini"),
    skillsDir: IS_WIN
      ? path.join(HOME, ".gemini", "skills")
      : path.join(HOME, ".gemini", "skills"),
  },
  {
    id: "hermes",
    labelKey: "agent_hermes",
    detectDir: IS_WIN ? path.join(HOME, ".hermes") : path.join(HOME, ".hermes"),
    skillsDir: IS_WIN
      ? path.join(HOME, ".hermes", "skills")
      : path.join(HOME, ".hermes", "skills"),
  },
  {
    id: "openclaw",
    labelKey: "agent_openclaw",
    detectDir: IS_WIN
      ? path.join(HOME, ".openclaw")
      : path.join(HOME, ".openclaw"),
    skillsDir: IS_WIN
      ? path.join(HOME, ".openclaw", "skills")
      : path.join(HOME, ".openclaw", "skills"),
  },
  {
    id: "windsurf",
    labelKey: "agent_windsurf",
    detectDir: IS_WIN
      ? path.join(HOME, ".codeium", "windsurf")
      : path.join(HOME, ".codeium", "windsurf"),
    skillsDir: IS_WIN
      ? path.join(HOME, ".codeium", "windsurf", "skills")
      : path.join(HOME, ".codeium", "windsurf", "skills"),
  },
  {
    id: "cline",
    labelKey: "agent_cline",
    detectDir: IS_WIN ? path.join(HOME, ".cline") : path.join(HOME, ".cline"),
    skillsDir: IS_WIN
      ? path.join(HOME, ".cline", "skills")
      : path.join(HOME, ".cline", "skills"),
  },
  {
    id: "roo",
    labelKey: "agent_roo",
    detectDir: IS_WIN ? path.join(HOME, ".roo") : path.join(HOME, ".roo"),
    skillsDir: IS_WIN
      ? path.join(HOME, ".roo", "skills")
      : path.join(HOME, ".roo", "skills"),
  },
  {
    id: "codebuddy",
    labelKey: "agent_codebuddy",
    detectDir: IS_WIN
      ? path.join(HOME, ".codebuddy")
      : path.join(HOME, ".codebuddy"),
    skillsDir: IS_WIN
      ? path.join(HOME, ".codebuddy", "skills")
      : path.join(HOME, ".codebuddy", "skills"),
  },
  {
    id: "qwen",
    labelKey: "agent_qwen",
    detectDir: IS_WIN ? path.join(HOME, ".qwen") : path.join(HOME, ".qwen"),
    skillsDir: IS_WIN
      ? path.join(HOME, ".qwen", "skills")
      : path.join(HOME, ".qwen", "skills"),
  },
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

function installOne(skillsRoot) {
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

function printPostInstall(destDir) {
  const p = prettyPath(destDir);
  console.log("");
  console.log(t("installed"));
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

function resolveAgentDir(agentId) {
  const a = AGENTS.find((x) => x.id === agentId);
  return a ? a.skillsDir : null;
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
      label: t(a.labelKey),
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
  const picked = menu.find((m) => m.index === choice);
  if (picked) {
    targetDir = picked.dir;
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

  console.log(t("installing"));
  try {
    const { destDir } = installOne(targetDir);
    printPostInstall(destDir);
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
    targets = detected.map((a) => ({ label: t(a.labelKey), dir: a.skillsDir }));
  } else if (customDir) {
    targets = [{ label: t("agent_custom"), dir: expandHome(customDir) }];
  } else if (agentFlag) {
    if (agentFlag === "custom") {
      console.error(
        LANG === "zh"
          ? "--agent custom 需同时提供 --dir <path>"
          : "--agent custom requires --dir <path>"
      );
      process.exit(1);
    }
    const dir = resolveAgentDir(agentFlag);
    if (!dir) {
      console.error(
        (LANG === "zh" ? "未知代理：" : "Unknown agent: ") + agentFlag
      );
      process.exit(1);
    }
    const a = AGENTS.find((x) => x.id === agentFlag);
    targets = [{ label: t(a.labelKey), dir }];
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
      const { destDir } = installOne(tgt.dir);
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
    printPostInstall(results[0].destDir);
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
    printPostInstall(results[0].destDir);
  } else {
    process.exit(1);
  }
}

// ─── Entry ───────────────────────────────────────────────────────────────────

(async function main() {
  if (showHelp) {
    printHeader();
    console.log(t("helpText"));
    process.exit(0);
  }

  if (uninstall && !agentFlag && !customDir && !installAll) {
    printHeader();
    const detected = detectAgents();
    const candidates = detected
      .map((a) => ({
        label: t(a.labelKey),
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
