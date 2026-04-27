from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCANNER = ROOT / "voscript-api" / "scripts" / "public_release_scan.py"


def run_git(root: Path, *args: str) -> None:
    subprocess.run(["git", "-C", str(root), *args], check=True, stdout=subprocess.PIPE)


def run_scan_with(content: str) -> subprocess.CompletedProcess[str]:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        run_git(root, "init", "-q")
        fixture = root / "fixture.md"
        fixture.write_text(content, encoding="utf-8")
        run_git(root, "add", "fixture.md")
        return subprocess.run(
            [sys.executable, str(SCANNER), "--root", str(root)],
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )


class PublicReleaseSecretScanTests(unittest.TestCase):
    def test_blocks_real_looking_env_style_secret_assignments(self) -> None:
        synthetic_value_a = "sk-live-" + "realisticsecret123456789"
        synthetic_value_b = "hf_" + "realisticsecret123456789"
        synthetic_value_c = "RealisticPassword" + "123456789"
        fixture = "\n".join(
            [
                f"API_KEY={synthetic_value_a}",
                f"export VOSCRIPT_API_KEY={synthetic_value_a}",
                f"TOKEN={synthetic_value_a}",
                f"VOSCRIPT_TOKEN={synthetic_value_a}",
                f"HF_TOKEN: {synthetic_value_b}",
                f"PASSWORD={synthetic_value_c}",
                f"password={synthetic_value_c}",
                f"SECRET={synthetic_value_a}",
                f"secret: {synthetic_value_a}",
            ]
        )

        result = run_scan_with(fixture)

        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("secret-looking assignment", result.stdout)

    def test_allows_secret_placeholders(self) -> None:
        fixture = "\n".join(
            [
                "export VOSCRIPT_API_KEY=<API_KEY>",
                "API_KEY=your-api-key",
                "TOKEN=your-token",
                "VOSCRIPT_TOKEN=your-api-key",
                "HF_TOKEN=${HF_TOKEN}",
                "PASSWORD=your-password",
                "password=changeme",
                "SECRET=<SECRET>",
                "secret: ''",
                "API_KEY=",
                "api_key: your_api_key_here",
            ]
        )

        result = run_scan_with(fixture)

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_blocks_quoted_key_secret_assignments(self) -> None:
        synthetic_value = "sk-live-" + "realisticsecret123456789"
        fixture = '{"api_key": "' + synthetic_value + '"}'

        result = run_scan_with(fixture)

        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)

    def test_blocks_markdown_inline_secret_assignments(self) -> None:
        synthetic_value = "sk-live-" + "realisticsecret123456789"
        fixture = (
            "Use `export VOSCRIPT_API_KEY="
            + synthetic_value
            + "` before running remote commands."
        )

        result = run_scan_with(fixture)

        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("secret-looking assignment", result.stdout)

    def test_blocks_markdown_list_secret_assignments(self) -> None:
        synthetic_value = "RealisticPassword" + "123456789"
        fixture = "- password=" + synthetic_value

        result = run_scan_with(fixture)

        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("secret-looking assignment", result.stdout)

    def test_blocks_markdown_inline_colon_secret_assignments(self) -> None:
        synthetic_value = "sk-live-" + "realisticsecret123456789"
        fixture = "Set `api_key: " + synthetic_value + "` in local-only config."

        result = run_scan_with(fixture)

        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("secret-looking assignment", result.stdout)

    def test_allows_markdown_inline_secret_placeholders(self) -> None:
        fixture = "\n".join(
            [
                "Use `export VOSCRIPT_API_KEY=<API_KEY>`.",
                "- password=changeme",
                "Set `api_key: your-api-key`.",
                "Use `TOKEN=$API_KEY`.",
                "Keep `HF_TOKEN=${HF_TOKEN}` in local config.",
                "Write `SECRET=REDACTED` in examples.",
            ]
        )

        result = run_scan_with(fixture)

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
