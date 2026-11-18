from __future__ import annotations

import importlib.util
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCANNER = ROOT / "voscript-api" / "scripts" / "public_release_scan.py"


def load_scanner():
    spec = importlib.util.spec_from_file_location(
        "voscript_public_release_scan", SCANNER
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


scanner = load_scanner()


def run_git(root: Path, *args: str) -> None:
    subprocess.run(["git", "-C", str(root), *args], check=True, stdout=subprocess.PIPE)


def scan_repository(
    root: Path, *, include_untracked: bool = False
) -> subprocess.CompletedProcess[str]:
    command = [sys.executable, str(SCANNER), "--root", str(root)]
    if include_untracked:
        command.append("--include-untracked")
    return subprocess.run(
        command,
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )


def scan_fixture(
    root: Path,
    path: Path,
    content: str,
    *,
    stage: bool = True,
    include_untracked: bool = False,
) -> subprocess.CompletedProcess[str]:
    run_git(root, "init", "-q")
    fixture = root / path
    fixture.parent.mkdir(parents=True, exist_ok=True)
    fixture.write_text(content, encoding="utf-8")
    if stage:
        run_git(root, "add", "--", str(path))
    return scan_repository(root, include_untracked=include_untracked)


def run_scan_with(
    content: str, filename: str = "fixture.md"
) -> subprocess.CompletedProcess[str]:
    with tempfile.TemporaryDirectory() as tmp:
        return scan_fixture(Path(tmp), Path(filename), content)


class PublicReleaseSecretScanTests(unittest.TestCase):
    def test_blocks_any_tracked_local_override_doc(self) -> None:
        local_suffix = "." + "local" + ".md"
        for filename in (
            "AGENTS" + local_suffix,
            "CLAUDE" + local_suffix,
            "docs/release" + local_suffix,
        ):
            with self.subTest(filename=filename):
                result = run_scan_with("local-only operator notes", filename=filename)

                self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
                self.assertIn("tracked local-only directory", result.stdout)

    def test_blocks_public_references_to_local_override_docs(self) -> None:
        local_suffix = "." + "local" + ".md"
        fixture = "\n".join(
            [
                "Keep operator details in AGENTS" + local_suffix + ".",
                "Do not publish docs/release" + local_suffix + ".",
            ]
        )

        result = run_scan_with(fixture)

        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("internal document reference", result.stdout)

    def test_internal_document_references_allow_sentence_punctuation(self) -> None:
        filenames = (
            "AGENTS" + ".local.md",
            "CLAUDE" + ".local.md",
            "docs/release" + ".local.md",
            "CONT" + "EXT.md",
            "ROAD" + "MAP.md",
            "ADR" + "0012-design.md",
        )
        for filename in filenames:
            references = (
                f"Read {filename}.",
                f"Read `{filename}`.",
                f"[details]({filename}).",
                f'<a href="{filename}">details</a>.',
                "Read " + filename.replace(".", "%2E") + ".",
                "Read " + filename.replace(".", "&#46;") + ".",
            )
            for content in references:
                with (
                    self.subTest(content=content),
                    tempfile.TemporaryDirectory() as tmp,
                ):
                    root = Path(tmp)
                    result = scan_fixture(root, Path("README.md"), content)
                    output = result.stdout + result.stderr
                    self.assertEqual(result.returncode, 1, output)
                    self.assertIn("internal document reference", output)
                    self.assertIn(scanner.REDACTED_EXCERPT, output)
                    self.assertNotIn(filename, output)
                    self.assertNotIn(content, output)
                    findings = scanner.line_findings(root, [Path("README.md")])
                    self.assertTrue(
                        any(
                            finding.category == "internal document reference"
                            for finding in findings
                        )
                    )
                    self.assertTrue(
                        all(
                            finding.excerpt == scanner.REDACTED_EXCERPT
                            for finding in findings
                        )
                    )

    def test_local_override_reference_does_not_match_a_longer_filename(self) -> None:
        for suffix in (".example", "-template", "x"):
            with self.subTest(suffix=suffix):
                filename = "AGENTS" + ".local.md" + suffix
                result = run_scan_with(f"Read {filename}.")
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

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

    def test_blocks_backtick_wrapped_secret_assignments(self) -> None:
        synthetic_value_a = "sk-live-" + "realisticsecret123456789"
        synthetic_value_b = "hf_" + "realisticsecret123456789"
        synthetic_value_c = "github_pat_" + "realisticsecret123456789"
        short_value = "abc"
        key_name = "api" + "_key"
        hf_name = "HF" + "_TOKEN"
        voscript_key_name = "VOSCRIPT" + "_API_KEY"
        token_name = "TO" + "KEN"
        fixture = "\n".join(
            [
                f"{key_name}: `{synthetic_value_a}`",
                f"{hf_name}=`{synthetic_value_b}`",
                f"- {voscript_key_name}: `{short_value}`",
                f"`export {token_name}=`{synthetic_value_c}``",
            ]
        )

        result = run_scan_with(fixture)

        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("secret-looking assignment", result.stdout)

    def test_blocks_raw_secret_tokens(self) -> None:
        bearer_value = "eyJ" + "realisticbearertoken1234567890"
        hf_value = "hf_" + "realisticsecret123456789"
        openai_value = "sk-" + "realisticsecret123456789"
        stripe_value_a = "sk_live_" + "realisticsecret123456789"
        stripe_value_b = "sk_live-" + "realisticsecret123456789"
        github_value_a = "ghp_" + "realisticsecret123456789"
        github_value_b = "github_pat_" + "realisticsecret123456789"
        fixture = "\n".join(
            [
                "Authorization: Bearer " + bearer_value,
                "Raw token: " + hf_value,
                "Raw token: " + openai_value,
                "Raw token: " + stripe_value_a,
                "Raw token: " + stripe_value_b,
                "Raw token: " + github_value_a,
                "Raw token: " + github_value_b,
            ]
        )

        result = run_scan_with(fixture)

        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("secret-looking raw token", result.stdout)

    def test_allows_markdown_inline_secret_placeholders(self) -> None:
        fixture = "\n".join(
            [
                "Use `export VOSCRIPT_API_KEY=<API_KEY>`.",
                "- password=changeme",
                "Set `api_key: your-api-key`.",
                "Use `TOKEN=$API_KEY`.",
                "Keep `HF_TOKEN=${HF_TOKEN}` in local config.",
                "Write `SECRET=REDACTED` in examples.",
                "Use `api_key: <API_KEY>`.",
                "Keep `HF_TOKEN=${API_KEY}`.",
                "- VOSCRIPT_API_KEY: `your-api-key`",
                "Write `TOKEN=`REDACTED``.",
                "Leave `api_key: `` blank.",
            ]
        )

        result = run_scan_with(fixture)

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_allows_raw_secret_placeholders(self) -> None:
        fixture = "\n".join(
            [
                "Authorization: Bearer <API_KEY>",
                "Authorization: Bearer ${API_KEY}",
                "Authorization: Bearer your-api-key",
                "Authorization: Bearer REDACTED",
                "Authorization: Bearer changeme",
                "Authorization: Bearer abc",
                "Raw token: <API_KEY>",
                "Raw token: ${API_KEY}",
                "Raw token: your-api-key",
                "Raw token: REDACTED",
                "Raw token: changeme",
                "Raw token:",
            ]
        )

        result = run_scan_with(fixture)

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


class PublicReleasePrivacyContractTests(unittest.TestCase):
    def test_scanner_rejects_tracked_internal_artifacts(self) -> None:
        paths = (
            Path("doc") / "adr" / "0012-design.md",
            Path("doc") / ("ADR" + "0012-design.md"),
            Path("nested") / ("CONT" + "EXT.md"),
            Path("nested") / ("CONT" + "EXT-MAP.md"),
            Path("nested") / ("AGENTS" + ".local.md"),
            Path("doc") / ("ROAD" + "MAP.md"),
            Path("doc") / ("A" + "DR.md"),
            Path("nested") / "roadmap" / "plan.md",
        )
        for path in paths:
            with self.subTest(path=path), tempfile.TemporaryDirectory() as tmp:
                result = scan_fixture(Path(tmp), path, "Synthetic internal notes.")
                self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
                self.assertIn("tracked local-only directory", result.stdout)

    def test_scanner_rejects_public_internal_references(self) -> None:
        references = (
            "[details](doc/" + "adr" + "/0012-design.md)",
            "[details](https://github.com/example/project/blob/main/doc/"
            + "ADR"
            + "0012-design.md)",
            "See `" + "CONT" + "EXT.md` for details.",
            "[details](doc/" + "%61" + "%64" + "%72" + "/0012-design.md)",
            "[details](doc/" + "roadmap" + "/plan.md)",
            "Read " + "AGENTS" + ".local.md before deploying.",
        )
        for reference in references:
            with self.subTest(reference=reference):
                result = run_scan_with(reference, "README.md")
                self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
                self.assertIn("internal document reference", result.stdout)

    def test_scanner_allows_normal_usage_prose_and_ignore_rules(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            result = scan_fixture(
                root,
                Path("README.md"),
                "Usage: configure the service and consult API documentation. "
                "Architecture decisions, context and a product roadmap "
                "are generic terms.",
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            ignored = "CONT" + "EXT.md"
            (root / ".gitignore").write_text(ignored + "\n", encoding="utf-8")
            (root / ignored).write_text(
                "Private untracked synthetic notes.", encoding="utf-8"
            )
            run_git(root, "add", ".gitignore")
            paths = scanner.tracked_files(root)
            self.assertFalse(scanner.path_findings(paths))
            self.assertFalse(scanner.line_findings(root, paths))
            self.assertNotIn(
                Path(ignored), scanner.tracked_files(root, include_untracked=True)
            )

    def test_public_sdk_identifier_is_not_a_raw_token_but_assignments_still_block(
        self,
    ) -> None:
        result = run_scan_with(
            "from huggingface_hub import hf_hub_download\n", "adapter.py"
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIsNotNone(
            scanner.secret_assignment_finding(
                "synthetic.py", 1, "API_KEY=" + "hf_" + "hub_download"
            )
        )
        self.assertIsNotNone(
            scanner.raw_secret_token_finding(
                "synthetic.py", 1, "hf_" + "syntheticnotasecret1234"
            )
        )

    def test_python_variable_forwarding_is_not_a_credential_literal(self) -> None:
        source = "download(" + "token=" + "use_auth_token)\n"
        result = run_scan_with(source, "adapter.py")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        literal = "download(" + "token=" + repr("use_auth_token") + ")\n"
        result = run_scan_with(literal, "adapter.py")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)

    def test_system_temporary_build_path_is_not_a_private_document_reference(
        self,
    ) -> None:
        path = "/" + "tmp" + "/synthetic-wheels"
        result = run_scan_with(f"RUN mkdir -p {path}\n", "Dockerfile")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        reference = path + "/operator-notes.md"
        result = run_scan_with(f"[notes]({reference})\n", "README.md")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)

    def test_public_container_path_exemption_is_exact_and_per_match(self) -> None:
        public_paths = (
            "/" + "data/voiceprints",
            "/" + "data/transcriptions/asnorm_cohort.npy",
        )
        private = "/" + "Users/example/private.txt"
        for public in public_paths:
            for suffix in ("", "-private", "/private.txt", ".private"):
                with self.subTest(public=public, suffix=suffix):
                    content = f"`{public}{suffix}`"
                    if not suffix:
                        content += f" `{private}`"
                    result = run_scan_with(content, "README.md")
                    self.assertEqual(
                        result.returncode, 1, result.stdout + result.stderr
                    )
                    self.assertIn("machine-local path", result.stdout)
                    self.assertNotIn(private, result.stdout + result.stderr)

    def test_exact_public_container_paths_remain_allowed(self) -> None:
        content = (
            "`/" + "data/voiceprints`, `/" + "data/transcriptions/asnorm_cohort.npy`"
        )
        result = run_scan_with(content, "README.md")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_every_diagnostic_redacts_the_entire_source_line(self) -> None:
        markers = (
            ("/" + "Users/example/private.txt", {"machine-local path"}),
            (
                "road" + "map/private.md",
                {"internal document reference", "local-only directory reference"},
            ),
            ("private" + " corpus", {"private validation corpus name"}),
            ("~/." + "ssh/config", {"local ssh" + " config path"}),
        )
        for marker, marker_categories in markers:
            with self.subTest(marker=marker), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                secret = "sk-live-" + "syntheticcredentialvalue123456789"
                content = "API_KEY=" + secret + " " + marker
                result = scan_fixture(root, Path("README.md"), content)
                output = result.stdout + result.stderr
                self.assertEqual(result.returncode, 1)
                self.assertNotIn(secret, output)
                self.assertNotIn(marker, output)
                self.assertNotIn(content, output)
                self.assertIn(scanner.REDACTED_EXCERPT, output)
                findings = scanner.line_findings(root, [Path("README.md")])
                required_categories = {"secret-looking assignment"} | marker_categories
                self.assertTrue(
                    required_categories <= {finding.category for finding in findings}
                )
                for category in required_categories:
                    self.assertIn(category, output)
                self.assertTrue(
                    all(
                        finding.excerpt == scanner.REDACTED_EXCERPT
                        for finding in findings
                    )
                )
                for finding in findings:
                    self.assertEqual(finding.path, "README.md")
                    self.assertEqual(finding.line, 1)
                    self.assertNotIn(secret, repr(finding))
                    self.assertNotIn(marker, repr(finding))

    def test_diagnostic_paths_cannot_echo_a_credential_in_a_tracked_filename(
        self,
    ) -> None:
        secret = "hf_" + "syntheticcredentialvalue123456789"
        result = run_scan_with("synthetic fixture", secret + ".wav")
        self.assertEqual(result.returncode, 1)
        self.assertIn("tracked media corpus file", result.stdout)
        self.assertNotIn(secret, result.stdout + result.stderr)
        self.assertIn("[sensitive path redacted]", result.stdout)

    def test_numbered_adr_filenames_and_references_share_the_same_boundary(
        self,
    ) -> None:
        filenames = (
            "ADR" + "0012_design.md",
            "ADR" + "0012-design.md",
            "ADR" + "0012.md",
        )
        for filename in filenames:
            with self.subTest(filename=filename), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                path = Path("doc") / filename
                self.assertTrue(scanner.is_internal_document(path))
                result = scan_fixture(root, path, "Synthetic decision text")
                self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
                self.assertIn("tracked local-only directory", result.stdout)
                (root / "README.md").write_text(
                    f"[decision](doc/{filename})", encoding="utf-8"
                )
                findings = scanner.line_findings(root, [Path("README.md")])
                self.assertTrue(
                    any(
                        finding.category == "internal document reference"
                        for finding in findings
                    )
                )

    def test_public_links_to_ignored_raw_validation_records_are_blocked(self) -> None:
        filenames = (
            "validation" + "-results.json",
            "validation" + "_records.jsonl",
            "validation" + "-logs.txt",
        )
        for filename in filenames:
            with self.subTest(filename=filename), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                (root / ".gitignore").write_text("logs/\n", encoding="utf-8")
                (root / "logs").mkdir()
                (root / "logs" / filename).write_text(
                    "Synthetic ignored record", encoding="utf-8"
                )
                result = scan_fixture(
                    root, Path("README.md"), f"[records](logs/{filename})"
                )
                self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
                self.assertIn("raw validation artifact reference", result.stdout)
                self.assertNotIn(Path("logs") / filename, scanner.tracked_files(root))
                self.assertNotIn(
                    Path("logs") / filename,
                    scanner.tracked_files(root, include_untracked=True),
                )

    def test_validation_usage_schema_is_not_a_raw_validation_record(self) -> None:
        result = run_scan_with(
            "Use validation-schema.json to validate request payloads.", "README.md"
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_include_untracked_scans_genuinely_unstaged_files_without_staging_them(
        self,
    ) -> None:
        for artifact in ("adr", "readme"):
            with self.subTest(artifact=artifact), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                filename = "ADR" + "0012_design.md"
                path = (
                    Path("doc") / filename if artifact == "adr" else Path("README.md")
                )
                content = (
                    "Synthetic decision"
                    if artifact == "adr"
                    else "[records](logs/" + "validation" + "-results.json)"
                )
                result = scan_fixture(root, path, content, stage=False)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertEqual(scanner.tracked_files(root), [])
                self.assertIn(path, scanner.tracked_files(root, include_untracked=True))
                full = scan_repository(root, include_untracked=True)
                self.assertEqual(full.returncode, 1, full.stdout + full.stderr)
                self.assertEqual(scanner.tracked_files(root), [])
                self.assertEqual(
                    subprocess.check_output(
                        ["git", "-C", str(root), "diff", "--cached", "--name-only"]
                    ),
                    b"",
                )

    def test_root_error_diagnostics_do_not_echo_synthetic_credentials(self) -> None:
        for exists in (False, True):
            with self.subTest(exists=exists), tempfile.TemporaryDirectory() as tmp:
                secret = "hf_" + "syntheticcredentialvalue123456789"
                root = Path(tmp) / secret
                if exists:
                    root.mkdir()
                result = scan_repository(root)
                self.assertEqual(result.returncode, 2)
                self.assertNotIn(secret, result.stdout + result.stderr)
                self.assertIn("redacted", result.stderr)


class PublicReleaseTextSurfaceTests(unittest.TestCase):
    SUFFIXES = (
        ".cfg",
        ".cjs",
        ".css",
        ".cts",
        ".dockerignore",
        ".env",
        ".gitignore",
        ".html",
        ".ini",
        ".js",
        ".json",
        ".jsx",
        ".map",
        ".md",
        ".mjs",
        ".mts",
        ".py",
        ".rst",
        ".sh",
        ".toml",
        ".ts",
        ".tsx",
        ".txt",
        ".yaml",
        ".yml",
    )

    def test_all_text_surfaces_block_secret_and_internal_references(self) -> None:
        secret = "sk-live-" + "syntheticcredentialvalue123456789"
        reference = "CONT" + "EXT.md"
        content = f"API_KEY={secret}\nRead {reference}."
        for suffix in self.SUFFIXES:
            for stage in (True, False):
                with (
                    self.subTest(suffix=suffix, stage=stage),
                    tempfile.TemporaryDirectory() as tmp,
                ):
                    result = scan_fixture(
                        Path(tmp),
                        Path("public" + suffix),
                        content,
                        stage=stage,
                        include_untracked=not stage,
                    )
                    output = result.stdout + result.stderr
                    self.assertEqual(result.returncode, 1, output)
                    self.assertIn("secret-looking assignment", output)
                    self.assertIn("internal document reference", output)
                    self.assertIn(scanner.REDACTED_EXCERPT, output)
                    self.assertNotIn(secret, output)
                    self.assertNotIn(reference, output)
                    self.assertNotIn(content, output)

    def test_all_text_surfaces_allow_public_placeholders(self) -> None:
        for suffix in self.SUFFIXES:
            with self.subTest(suffix=suffix):
                result = run_scan_with(
                    "API_KEY=<API_KEY>\nUsage: configure the service.",
                    "public" + suffix,
                )
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_internal_document_diagnostic_paths_are_redacted(self) -> None:
        paths = [
            Path(directory) / "synthetic-operator-note.md"
            for directory in (
                "adr",
                "adrs",
                "roadmap",
                "tmp",
                "internal",
                "local-docs",
                "local_docs",
                "validation-notes",
                "validation_notes",
            )
        ] + [
            Path("doc") / ("ADR" + "0012-synthetic-decision.md"),
            Path("doc") / ("CONT" + "EXT.md"),
            Path("doc") / ("CONT" + "EXT-MAP.md"),
            Path("doc") / ("ROAD" + "MAP.md"),
            Path("release" + ".local.md"),
        ]
        for path in paths:
            with self.subTest(path=path):
                result = run_scan_with("Synthetic operator-only note.", str(path))
                output = result.stdout + result.stderr
                self.assertEqual(result.returncode, 1, output)
                self.assertIn("tracked local-only directory", output)
                self.assertIn("[sensitive path redacted]:1:", output)
                self.assertNotIn(str(path), output)
                self.assertNotIn(path.name, output)
                self.assertIn(scanner.REDACTED_EXCERPT, output)
                self.assertEqual(
                    scanner.diagnostic_path(str(path)), "[sensitive path redacted]"
                )

    def test_public_diagnostic_paths_remain_available(self) -> None:
        secret = "hf_" + "syntheticcredentialvalue123456789"
        result = run_scan_with("API_KEY=" + secret, "doc/usage.md")
        output = result.stdout + result.stderr
        self.assertEqual(result.returncode, 1, output)
        self.assertIn("doc/usage.md:1: secret-looking assignment", output)
        self.assertNotIn(secret, output)
        self.assertEqual(scanner.diagnostic_path("doc/usage.md"), "doc/usage.md")


if __name__ == "__main__":
    unittest.main()
