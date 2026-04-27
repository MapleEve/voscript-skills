# VoScript Release Workflow

Use this workflow when preparing a VoScript main-repository PR, release, or Docker publication.

## Required order

1. Confirm the worktree branch, remote tracking branch, and cleanliness.
2. If any release validation, deployment, restart, smoke test, or log check
   requires SSH on a remote VoScript host, read
   `references/remote-debugging.md` first. Verify the documented direct SSH
   alias first; if it is unavailable, use the documented WAN ProxyCommand flow.
   Keep the actual alias names, proxy address, proxy port, host, user, key, and
   deployment path in local-only configuration. Do not open iTerm or invent new
   tunnels. If the tool sandbox cannot reach either documented route but the
   user's terminal can, do not diagnose the remote as unreachable; stop and
   report that the local-terminal route is required.
3. Run the public privacy scan before writing PR or release text:

   ```bash
   python voscript-api/scripts/public_release_scan.py --root <REPO_ROOT>
   ```

4. Verify version metadata and changelog are aligned.
5. Run the same fast checks as the repository CI: lint, format, unit/security tests, and dependency audit.
6. Create or update the PR with anonymized text only.
7. Wait for PR checks and inspect logs before merging if any check fails.
8. Before merge, review changed files, release notes, public leak scan, Docker healthcheck, version metadata, and changelog.
9. Merge using the repository's existing merge style.
10. Create the GitHub release/tag only after the merge commit is known.
11. Watch the Docker release workflow until it finishes. Report image tags and digests when available.
12. Before deleting any feature worktree, complete the post-release local wrap-up checklist below.

## Remote deploy verification

When a release must be started on a remote VoScript host, use this order after
the PR merge/tag/release source is known:

1. Verify the route with the documented direct SSH alias, or with the WAN
   ProxyCommand from `remote-debugging.md` if direct SSH is unavailable.
2. On the remote checkout, inspect branch, upstream, dirty files, and current
   commit before changing anything.
3. If the remote checkout is dirty, save both a status file and patch under an
   ignored backup directory, then `git stash push -u` with a timestamped message.
   Do not discard remote edits without a recoverable backup.
4. Fetch tags and update only to the intended release branch, tag, or merge
   commit. If a hard reset is necessary to deploy the release, do it only after
   step 3.
5. Rebuild/restart the container using the repository's compose/service
   definition. Do not delete runtime data, ignored validation artifacts, or
   persisted model/voiceprint stores unless the user explicitly asks.
6. Treat container/service `voscript` on the default service port as primary.
   Old candidate containers or candidate ports are not release failures unless
   this release explicitly targets that candidate.
7. Wait for readiness. Retry `/healthz` during cold start instead of treating an
   immediate connection reset as final failure.
8. Confirm `/healthz` returns 200 and `/openapi.json` reports the intended
   release version.
9. Start a persistent `docker logs -f --tail=200` monitor into an ignored remote
   log file, tail it, and check startup/model/worker errors.
10. If the client URL returns "plain HTTP request was sent to HTTPS port", switch
   the same host and service port to `https://` before reporting the usable
   entrypoint.
11. Report only sanitized state: commit/tag, health, version, monitor location,
    and whether backups were created. Do not paste secrets, real hostnames, raw
    private logs, or private paths into public release text.

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
3. Identify feature-worktree ignored artifacts that must be retained, such as validation outputs, private planning notes, release scratch files, and command logs.
4. Move retained local-only material into the repository's agreed ignored local-only archive.
5. Before moving files, confirm the main worktree's `.gitignore` covers the destination path and file patterns. If it does not, update the ignore rules first and verify the files remain untracked.
6. Do not convert raw logs, job IDs, speaker IDs, hostnames, local paths, corpus names, media filenames, or private planning links into tracked public docs during this wrap-up.
7. Before deleting the feature worktree, confirm that every retained artifact has been migrated to the main worktree archive or that the operator explicitly confirmed it can be discarded.

## Stop conditions

- If credentials are missing, report the missing secret or registry scope.
- If a workflow fails twice after one focused retry, stop and report the failure chain.
- If a public scan finds private material, fix or anonymize before continuing.
