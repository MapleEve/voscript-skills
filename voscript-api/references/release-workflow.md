# VoScript Release Workflow

Use this workflow when preparing a VoScript main-repository PR, release, or Docker publication.

## Skills npm publication

For the `voscript-skills` package, use its repository workflows rather than the
main application's Docker publication flow:

1. Keep the package version and skill metadata version aligned. Scanner logic
   fixes require a patch version; documentation-only changes do not.
2. Pull requests run the public scan, unit tests, and npm package dry run on CI
   with Node.js 24. The main-branch publication workflow reuses the same checks
   before any publishing job can start.
3. Publish only the checked-out triggering commit. Registry lookup errors block
   publication; they must not be treated as an unpublished package version.
4. Keep validation read-only. Grant provenance identity permission only to the
   npm job, and expose the existing `NPM_TOKEN` only to the npm publish step.
   GitHub Release creation has its own contents-write job. Do not remove the
   token or switch authentication modes without verifying registry publisher
   configuration and obtaining operator approval.
5. Verify the npm version's `gitHead` matches the triggering commit. Atomically
   create its remote Git tag ref at that exact SHA without overwriting any
   existing ref. On a creation conflict, read the actual remote ref and peel
   annotated tags to the commit; require an exact match. Create the GitHub
   Release with `--verify-tag`, then re-read and verify the remote tag even if
   the Release already existed. A retry skips an already published npm version
   and repairs a missing tag or Release only for the same source SHA. API
   errors, missing refs, and mismatched targets block completion; never retag.
6. Confirm npm publication and the GitHub Release before updating installed
   skill copies. Preserve agent authentication settings and local operator
   configuration; skill installation does not require changing API identities
   or enabling a different OAuth provider.

Use the post-release checkout and wrap-up gates below for the skills source
repository too. Do not report a prepared version as published before CI and
registry verification complete.

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
5. Require successful repository CI for lint, format, unit/security tests, dependency audit, and required heavy checks on the exact source commit.
6. Create or update the PR with anonymized text only.
7. Wait for PR checks and inspect logs before merging if any check fails.
8. Before merge, review changed files, release notes, public leak scan, Docker healthcheck, version metadata, and changelog.
9. Merge using the repository's existing merge style.
10. Create the stable version tag and publish its non-draft, non-prerelease GitHub
    Release only after the integrated main PR merge commit and its checks are
    known. The tag must match the application version and resolve to that exact
    integrated commit, reachable from `main`.
11. Manually dispatch `.github/workflows/release.yml` from branch `main`, passing
    the already published stable `v<version>` as input `tag`. Creating/pushing a
    tag or publishing a GitHub Release does not automatically trigger Docker
    publication; dispatching from a tag or feature branch is not supported.
12. Require the read-only `validate-source` job to succeed first. It checks out
    the immutable trusted main control SHA, validates the tag, integrated PR,
    main ancestry, stable Release, version, branch protection and exact-SHA CI
    evidence, then scans the validated source using the trusted main scanner.
    Candidate metadata is parsed as data; candidate helpers are not executed
    in this validation job, and it has no registry publishing permission.
13. Only then may `publish` build the exact validated source, audit and smoke
    the immutable image, revalidate source evidence before registry writes, and
    push that same image without rebuilding. Wait for the workflow to finish;
    record the tag, source SHA, workflow result, image tags and digests.
14. Complete the post-release local checkout sync checklist below.
15. Before deleting any feature worktree, complete the post-release local wrap-up checklist below.

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
5. Pull the intended published image and recreate the service using the
   repository's compose definition with `--no-build`; do not rebuild the release
   locally. Do not delete runtime data, ignored validation artifacts, or
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

The main repository publishes Docker images only through a manual dispatch of
`.github/workflows/release.yml` from `main`, using an existing published stable
tag. Trusted main read-only validation must pass before publishing begins.
Tag pushes and GitHub Release events do not trigger this workflow. Do not invent
another registry or push path.

For VoScript 0.8.x, expected public tags are:

- GHCR: `ghcr.io/mapleeve/voscript:v<version>` and `ghcr.io/mapleeve/voscript:sha-<source-sha>`
- Docker Hub: `mapleeve/voscript:<version>` and `mapleeve/voscript:sha-<source-sha>`

Both registries receive `latest` only when the selected tag is the latest
published GitHub Release; publishing an older stable tag must not roll `latest`
back. A GitHub Release alone is not evidence that its Docker images exist.

## Post-release local checkout sync

After a release is published, the operator's durable local checkouts must be
aligned with the released `origin/main` state before the release is considered
closed.

This is a hard gate for every release, merge, or post-release close-out. It is
not enough to sync only the primary `main` checkout. Before deleting branches,
worktrees, or local-only material, inspect the complete local and GitHub state:

- GitHub open PRs for the repository, including PRs whose branch name looks
  stale or superseded.
- Every sibling git worktree for the repository, including historical release,
  docs, fix, and scratch worktrees outside the primary checkout.
- `git stash list` in the repository.
- Local branches with upstream, ahead/behind, divergence, and unpushed commits.
- Remote-tracking branches whose upstream is gone.
- Tag fetch state, including local tag conflicts.
- For `voscript-skills` changes, the source skill tree and every locally
  installed skill tree that must be kept in sync. Ignore installer metadata such
  as `.install.json` when comparing installed skill content.

If any open PR, worktree, stash, local branch, or gone remote-tracking branch
contains effective code or documentation that has not been merged into the
released line, stop cleanup and close that work first through the repository's
normal PR or merge path. Only clear branches, worktrees, or stashes after they
are proven replaced by the released line, intentionally abandoned by the
operator, or migrated into an agreed ignored local-only archive. Do not treat
"branch looks old" or "main is current" as proof that the work is disposable.

1. Inspect the main local checkout for each repository touched by the release,
   including the VoScript main repository and the `voscript-skills` source
   repository when skill docs or scripts changed.
2. For each checkout, record the current branch, upstream, HEAD commit,
   cleanliness, ahead/behind count, and tag-fetch status before changing
   anything.
3. If the checkout is clean and only behind `origin/main`, update it with
   `git pull --ff-only` or an equivalent fast-forward-only operation.
4. If the checkout is dirty, ahead, divergent, or has local tag conflicts, do
   not reset, force-pull, delete tags, or discard changes. First create a
   recoverable backup such as a local branch, patch, or stash as appropriate,
   then report the state and use only a safe fast-forward or non-destructive
   merge path. If the safe path is unclear, stop for operator confirmation.
5. Confirm the final local main checkout matches `origin/main` after the release
   PR/merge is complete. If a local backup branch, stash, patch, or unresolved
   tag conflict remains, report it explicitly in the release close-out notes.
6. Do not delete runtime data, ignored validation outputs, persisted
   voiceprints, model caches, or AS-norm cohort state during local checkout
   alignment unless the operator explicitly asks.
7. Confirm the final close-out report lists each gate above and its result:
   GitHub open PRs, sibling worktrees, stash list, local branches ahead/behind,
   gone remote-tracking branches, tag-fetch conflicts, source-vs-installed skill
   diff, and any retained or intentionally discarded local material.

## Post-release local wrap-up checklist

After release publication is complete, do not leave local-only validation material in a feature worktree that is about to be deleted.

1. Read-only inspect both the main worktree and the feature worktree before changing anything:
   - In the main worktree, check branch, upstream, cleanliness, and whether it is ahead/behind or divergent.
   - In the feature worktree, check tracked changes, untracked files, and ignored files.
   - Also enumerate all sibling worktrees, open PRs, stashes, local branches,
     gone remote-tracking branches, tag-fetch conflicts, and installed skill
     diffs covered by the post-release local checkout sync gate.
2. If the main worktree is dirty, ahead, divergent, or has tag conflicts, follow
   the post-release local checkout sync checklist above before making changes.
   Do not reset, force-pull, delete tags, or discard local edits.
3. Identify feature-worktree ignored artifacts that must be retained, such as validation outputs, private planning notes, release scratch files, and command logs.
4. Move retained local-only material into the repository's agreed ignored local-only archive.
5. Before moving files, confirm the main worktree's `.gitignore` covers the destination path and file patterns. If it does not, update the ignore rules first and verify the files remain untracked.
6. Do not convert raw logs, job IDs, speaker IDs, hostnames, local paths, corpus names, media filenames, or private planning links into tracked public docs during this wrap-up.
7. Before deleting the feature worktree, confirm that every retained artifact has been migrated to the main worktree archive or that the operator explicitly confirmed it can be discarded.
8. The final wrap-up report must explicitly list the result of each required
   gate and identify any open PR, worktree, stash, branch, gone remote-tracking
   branch, tag conflict, or installed skill drift that remains.

## Stop conditions

- If credentials are missing, report the missing secret or registry scope.
- If a workflow fails twice after one focused retry, stop and report the failure chain.
- If a public scan finds private material, fix or anonymize before continuing.
