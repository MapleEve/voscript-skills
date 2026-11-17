"""Synthetic operator-rule regressions migrated to the package's unittest CI."""

from __future__ import annotations

import ast
import json
import os
import unittest
from unittest.mock import patch

from test_public_release_scan import SCANNER, run_scan_with, scanner


RULES_ENV = "VOSCRIPT_PUBLIC_SCAN_RULES_JSON"


class PublicScanOperatorRuleTests(unittest.TestCase):
    def setUp(self) -> None:
        environment = patch.dict(os.environ)
        environment.start()
        self.addCleanup(environment.stop)
        os.environ.pop(RULES_ENV, None)

    def test_generic_ssh_host_tokens_block_literals_without_knowing_aliases(self) -> None:
        for arguments in (
            " synthetic-deployment",
            " operator@synthetic-host",
            " -p 45678 synthetic-target",
            " -i <KEY_FILE> synthetic-host",
        ):
            with self.subTest(arguments=arguments):
                result = run_scan_with("ssh" + arguments, "README.md")
                self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
                self.assertIn("literal SSH host", result.stdout)
                self.assertNotIn(arguments, result.stdout + result.stderr)

    def test_explicit_ssh_placeholders_remain_public(self) -> None:
        for arguments in (
            " <SSH_ALIAS>",
            " -p <SSH_PORT> <SSH_ALIAS>",
            " <USER>@<HOST>",
            " ${SSH_ALIAS}",
        ):
            with self.subTest(arguments=arguments):
                result = run_scan_with("ssh" + arguments, "README.md")
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_generic_nonpublic_local_debug_port_is_redacted(self) -> None:
        for prefix in ("localhost:", "127.0.0.1:", "[::1]:", "SOCKS_PORT="):
            with self.subTest(prefix=prefix):
                synthetic_port = str(45678)
                result = run_scan_with(prefix + synthetic_port, "README.md")
                self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
                self.assertIn("non-public local debug port", result.stdout)
                self.assertNotIn(synthetic_port, result.stdout + result.stderr)

    def test_placeholder_ssh_cannot_hide_a_later_literal_host(self) -> None:
        first = "ssh" + " <SSH_ALIAS>"
        for separator in ("; ", " && ", " || ", "\n"):
            with self.subTest(separator=separator):
                content = first + separator + "ssh" + " synthetic-host"
                result = run_scan_with(content, "README.md")
                self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
                self.assertIn("literal SSH host", result.stdout)
                self.assertNotIn("synthetic-host", result.stdout + result.stderr)
                allowed = run_scan_with(
                    first + separator + "ssh" + " <SSH_ALIAS>", "README.md"
                )
                self.assertEqual(allowed.returncode, 0, allowed.stdout + allowed.stderr)

    def test_public_service_and_socks_placeholder_are_allowed(self) -> None:
        result = run_scan_with(
            "http://localhost:8780/healthz\nlocalhost:<SOCKS_PORT>\n", "README.md"
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_optional_markers_are_literal_external_input_and_never_echoed(self) -> None:
        marker = "synthetic-operator-marker[.]"
        os.environ[RULES_ENV] = json.dumps({"markers": [marker]})
        result = run_scan_with("Deployment note: " + marker, "README.md")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("operator private marker", result.stdout)
        self.assertNotIn(marker, result.stdout + result.stderr)
        self.assertNotIn(marker, SCANNER.read_text(encoding="utf-8"))

    def test_invalid_optional_input_has_no_parse_details_or_marker_echo(self) -> None:
        invalid = "synthetic-private-value-invalid-json"
        os.environ[RULES_ENV] = invalid
        result = run_scan_with("Public usage instructions", "README.md")
        self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
        self.assertNotIn(invalid, result.stdout + result.stderr)
        self.assertNotIn("Traceback", result.stderr)
        self.assertIn("invalid optional operator rules", result.stderr)

    def test_unknown_bare_alias_does_not_claim_complete_detection(self) -> None:
        result = run_scan_with(
            "An unclassified synthetic-bare-operator-name", "README.md"
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertFalse(scanner.operator_rules_from_env())

    def test_removed_machine_fact_constants_cannot_be_reintroduced_as_concatenations(
        self,
    ) -> None:
        tree = ast.parse(SCANNER.read_text(encoding="utf-8"))
        assigned = {
            target.id
            for node in ast.walk(tree)
            if isinstance(node, ast.Assign)
            for target in node.targets
            if isinstance(target, ast.Name)
        }
        obsolete = {
            "PRIVATE_" + suffix
            for suffix in (
                "DIRECT_SSH_ALIAS",
                "WAN_SSH_ALIAS",
                "REMOTE_ALIASES",
                "PROXY_HOST_PORT",
            )
        }
        self.assertFalse(assigned.intersection(obsolete))
        self.assertEqual(scanner.PUBLIC_SERVICE_PORTS, {80, 443, 8780})


if __name__ == "__main__":
    unittest.main()
