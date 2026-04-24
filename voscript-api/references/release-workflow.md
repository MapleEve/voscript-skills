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
11. Before deleting any feature worktree, complete the post-release local wrap-up checklist below.

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

## Post-release local wrap-up checklist

After release publication is complete, do not leave local-only validation material in a feature worktree that is about to be deleted.

1. Read-only inspect both the main worktree and the feature worktree before changing anything:
   - In the main worktree, check branch, upstream, cleanliness, and whether it is ahead/behind or divergent.
   - In the feature worktree, check tracked changes, untracked files, and ignored files.
2. If the main worktree is dirty, ahead/behind, or divergent, do not automatically pull, rebase, merge, or reset it. Report the state and wait for the operator's decision.
3. Identify feature-worktree ignored artifacts that must be retained, such as validation outputs, local roadmap notes, release scratch files, and command logs.
4. Move retained local-only material into an ignored path in the main worktree, for example `tmp/`, `roadmap/`, or the repository's agreed local-only archive.
5. Before moving files, confirm the main worktree's `.gitignore` covers the destination path and file patterns. If it does not, update the ignore rules first and verify the files remain untracked.
6. Do not convert raw logs, job IDs, speaker IDs, hostnames, local paths, corpus names, media filenames, or private planning links into tracked public docs during this wrap-up.
7. Before deleting the feature worktree, confirm that every retained artifact has been migrated to the main worktree archive or that the operator explicitly confirmed it can be discarded.

## Stop conditions

- If credentials are missing, report the missing secret or registry scope.
- If a workflow fails twice after one focused retry, stop and report the failure chain.
- If a public scan finds private material, fix or anonymize before continuing.
