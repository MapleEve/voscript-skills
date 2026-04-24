# VoScript Release Workflow

Use this workflow when preparing a VoScript main-repository PR, release, or Docker publication.

## Required order

1. Confirm the worktree branch, remote tracking branch, and cleanliness.
2. Run the public privacy scan before writing PR or release text:

   ```bash
   python voscript-api/scripts/public_release_scan.py --root <REPO_ROOT>
   ```

3. Verify version metadata and changelog are aligned.
4. Run the same fast checks as the repository CI: lint, format, unit/security tests, and dependency audit.
5. Create or update the PR with anonymized text only.
6. Wait for PR checks and inspect logs before merging if any check fails.
7. Before merge, review changed files, release notes, public leak scan, Docker healthcheck, version metadata, and changelog.
8. Merge using the repository's existing merge style.
9. Create the GitHub release/tag only after the merge commit is known.
10. Watch the Docker release workflow until it finishes. Report image tags and digests when available.

## Public wording rules

- Good: "internal live validation", "internal benchmark set", "AS-norm enrollment/probe path".
- Do not publish hostnames, local paths, media filenames, raw logs, debug ports, job IDs, speaker IDs, keys, tokens, or private planning links.
- Public release notes may describe behavior verified, but not the private material used to verify it.

## Docker publication checks

The main repository publishes Docker images through its release workflow. Do not invent another registry or push path.

For VoScript 0.7.x, expected public tags are:

- GHCR: `ghcr.io/mapleeve/voscript:latest` and `ghcr.io/mapleeve/voscript:v<version>`
- Docker Hub: `<dockerhub-user>/voscript:latest` and `<dockerhub-user>/voscript:<version>`

If both `push tag` and `release published` workflows run for the same commit, treat them as duplicate publications of the same source. Wait for completion and report both if they differ.

## Stop conditions

- If credentials are missing, report the missing secret or registry scope.
- If a workflow fails twice after one focused retry, stop and report the failure chain.
- If a public scan finds private material, fix or anonymize before continuing.
