#!/usr/bin/env python3
"""Scan tracked files for public-release privacy leaks.

The scanner is intentionally lightweight: it checks Git-tracked files for
local-only paths, validation artifacts, private corpus names, deployment
details, and real-looking VoScript IDs. Use it before publishing docs, PRs, or
release notes that mention VoScript validation.
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence


MEDIA_EXTENSIONS = {
    ".aac",
    ".flac",
    ".m4a",
    ".mkv",
    ".mov",
    ".mp3",
    ".mp4",
    ".ogg",
    ".opus",
    ".wav",
    ".webm",
}

TEXT_EXTENSIONS = {
    ".cfg",
    ".css",
    ".dockerignore",
    ".env",
    ".gitignore",
    ".html",
    ".ini",
    ".js",
    ".json",
    ".md",
    ".py",
    ".rst",
    ".sh",
    ".toml",
    ".txt",
    ".yaml",
    ".yml",
}

ALLOW_CONTENT = {
    "voscript-api/SKILL.md",
    "voscript-api/references/privacy-baseline.md",
    "voscript-api/scripts/public_release_scan.py",
}


@dataclass(frozen=True)
class Rule:
    name: str
    pattern: re.Pattern[str]
    advice: str


def _rx(value: str, flags: int = 0) -> re.Pattern[str]:
    return re.compile(value, flags)


PRIVATE_E2E_DIR = "E2E" + "_" + "sound"
PRIVATE_REMOTE_ALIASES = ("ai" + "-wan", "ai" + "-lan")


LINE_RULES = [
    Rule(
        "internal roadmap wording",
        _rx(r"\b(?:road" + r"map visibility|main-project road" + r"map)\b", re.I),
        "Remove roadmap-specific release wording from public docs.",
    ),
    Rule(
        "private validation corpus name",
        _rx(
            rf"\b(?:tmp[/\\]{PRIVATE_E2E_DIR}|{PRIVATE_E2E_DIR}|private E2E (?:corpus|sample)|private (?:corpus|sample))\b",
            re.I,
        ),
        "Use anonymized wording such as internal live validation.",
    ),
    Rule(
        "machine-local path",
        _rx(r"(?:/Users/|/data/)[^\s)\"'`]+"),
        "Move machine-specific paths to local-only notes.",
    ),
    Rule(
        "remote host alias",
        _rx(rf"\b(?:{'|'.join(PRIVATE_REMOTE_ALIASES)})\b", re.I),
        "Replace private host aliases with generic deployment wording.",
    ),
    Rule(
        "candidate debug port",
        _rx(r"\b18(?:7[0-9]{2}|78[0-9])\b"),
        "Do not publish temporary candidate/debug ports.",
    ),
    Rule(
        "real transcription id",
        _rx(r"\btr_[0-9]{8}_[0-9]{6}_[A-Za-z0-9_-]+\b"),
        "Replace real transcription IDs with <tr_id>.",
    ),
    Rule(
        "real speaker id",
        _rx(r"\bspk_[0-9a-f]{6,}\b", re.I),
        "Replace real speaker IDs with <speaker_id>.",
    ),
    Rule(
        "inline secret-looking value",
        _rx(r"\b(?:api[_-]?key|token|password|secret)\s*[:=]\s*['\"](?!<|\$|your_|example)[A-Za-z0-9_+/\-.]{12,}['\"]", re.I),
        "Use placeholders such as <API_KEY>; rotate if this is a real secret.",
    ),
]

PUBLIC_CONTAINER_PATHS = {
    "/data/voiceprints",
    "/data/transcriptions/asnorm_cohort.npy",
}


@dataclass(frozen=True)
class Finding:
    category: str
    path: str
    line: int
    excerpt: str
    advice: str


def run_git(root: Path, args: Sequence[str]) -> subprocess.CompletedProcess[bytes]:
    return subprocess.run(
        ["git", "-C", str(root), *args],
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def tracked_files(root: Path) -> list[Path]:
    proc = run_git(root, ["ls-files", "-z"])
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.decode("utf-8", "replace").strip())
    return [Path(p.decode("utf-8")) for p in proc.stdout.split(b"\0") if p]


def is_text_file(path: Path) -> bool:
    if path.name in {".gitignore", ".dockerignore"}:
        return True
    return path.suffix.lower() in TEXT_EXTENSIONS or not path.suffix


def path_findings(paths: Iterable[Path]) -> list[Finding]:
    findings: list[Finding] = []
    for rel in paths:
        parts = rel.parts
        suffix = rel.suffix.lower()
        rel_str = rel.as_posix()
        if parts and parts[0] in {"roadmap", "tmp"}:
            findings.append(
                Finding(
                    "tracked local-only directory",
                    rel_str,
                    1,
                    rel_str,
                    "Remove tracked planning/tmp artifacts or move them to ignored local storage.",
                )
            )
        if rel.name == "CLAUDE.local.md" or (
            rel.name.startswith(".env") and rel.name != ".env.example"
        ):
            findings.append(
                Finding(
                    "tracked local config file",
                    rel_str,
                    1,
                    rel_str,
                    "Untrack local config files and keep them ignored.",
                )
            )
        if suffix in MEDIA_EXTENSIONS:
            findings.append(
                Finding(
                    "tracked media corpus file",
                    rel_str,
                    1,
                    rel_str,
                    "Do not publish raw audio/video validation material.",
                )
            )
        if suffix in {".log", ".json", ".txt"} and "validation" in rel_str.lower():
            findings.append(
                Finding(
                    "tracked validation artifact",
                    rel_str,
                    1,
                    rel_str,
                    "Keep raw validation logs/results local-only.",
                )
            )
    return findings


def line_findings(root: Path, paths: Iterable[Path]) -> list[Finding]:
    findings: list[Finding] = []
    for rel in paths:
        rel_str = rel.as_posix()
        if rel_str in ALLOW_CONTENT or not is_text_file(rel):
            continue
        full = root / rel
        try:
            lines = full.read_text(encoding="utf-8", errors="replace").splitlines()
        except OSError:
            continue
        for line_no, line in enumerate(lines, start=1):
            for rule in LINE_RULES:
                if rule.pattern.search(line):
                    if rule.name == "machine-local path" and any(
                        path in line for path in PUBLIC_CONTAINER_PATHS
                    ):
                        continue
                    excerpt = line.strip()
                    if len(excerpt) > 180:
                        excerpt = excerpt[:177] + "..."
                    findings.append(
                        Finding(rule.name, rel_str, line_no, excerpt, rule.advice)
                    )
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Scan Git-tracked files for VoScript public-release privacy leaks."
    )
    parser.add_argument(
        "--root",
        default=".",
        help="Repository root to scan. Defaults to current directory.",
    )
    args = parser.parse_args()

    root = Path(args.root).expanduser().resolve()
    if not root.exists():
        print(f"root does not exist: {root}", file=sys.stderr)
        return 2

    try:
        paths = tracked_files(root)
    except RuntimeError as exc:
        print(f"not a git worktree or git failed: {exc}", file=sys.stderr)
        return 2

    findings = path_findings(paths) + line_findings(root, paths)
    if findings:
        print("Public release scan failed:")
        for item in findings:
            print(f"- {item.path}:{item.line}: {item.category}")
            print(f"  {item.excerpt}")
            print(f"  {item.advice}")
        return 1

    print(f"Public release scan passed ({len(paths)} tracked files).")
    return 0


if __name__ == "__main__":
    os.environ.setdefault("PYTHONUTF8", "1")
    sys.exit(main())
