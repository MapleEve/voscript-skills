#!/usr/bin/env node
/**
 * VoScript Skills installer
 *
 * Copies the voscript-api skill to ~/.claude/skills/voscript-api/
 * so any Claude Code (or compatible) AI agent can load it.
 *
 * Usage:
 *   npx voscript-skills          # install to ~/.claude/skills/
 *   npx voscript-skills --dir /custom/skills/path
 *   npx voscript-skills --uninstall
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

// ─── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const uninstall = args.includes("--uninstall") || args.includes("-u");
const dirIdx = args.indexOf("--dir");
const customDir = dirIdx !== -1 ? args[dirIdx + 1] : null;

// ─── Paths ───────────────────────────────────────────────────────────────────

const skillName = "voscript-api";
const pkgRoot = path.join(__dirname, "..");
const srcDir = path.join(pkgRoot, skillName);

const defaultSkillsRoot = path.join(os.homedir(), ".claude", "skills");
const skillsRoot = customDir || defaultSkillsRoot;
const destDir = path.join(skillsRoot, skillName);

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) removeDirRecursive(p);
    else fs.unlinkSync(p);
  }
  fs.rmdirSync(dir);
}

// ─── Main ────────────────────────────────────────────────────────────────────

if (uninstall) {
  if (fs.existsSync(destDir)) {
    removeDirRecursive(destDir);
    console.log(`✓ Uninstalled: ${destDir}`);
  } else {
    console.log(`Not installed: ${destDir}`);
  }
  process.exit(0);
}

if (!fs.existsSync(srcDir)) {
  console.error(`Error: skill source not found at ${srcDir}`);
  process.exit(1);
}

const existed = fs.existsSync(destDir);
copyDirRecursive(srcDir, destDir);

if (existed) {
  console.log(`✓ Updated voscript-api skill → ${destDir}`);
} else {
  console.log(`✓ Installed voscript-api skill → ${destDir}`);
}

console.log();
console.log("Next steps:");
console.log("  1. Set environment variables:");
console.log("       export VOSCRIPT_URL=http://localhost:7880");
console.log("       export VOSCRIPT_API_KEY=your_api_key");
console.log();
console.log("  2. Load the skill in your AI agent by pointing to:");
console.log(`       ${destDir}/SKILL.md`);
console.log();
console.log("  Documentation: https://github.com/MapleEve/voscript-skills");
