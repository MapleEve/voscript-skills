# VoScript Remote Debugging

Use this minimal runbook for every remote VoScript debugging session. Prefer the
tool environment route first; fall back to the WAN proxy route only when the
direct alias is unavailable.

## Non-negotiable rule

Do not open iTerm or another GUI terminal for remote debugging. Run SSH commands
from the tool environment whenever possible. The fixed route order is:

```bash
ssh ai '<cmd>'
```

If `ssh ai` is unavailable, use the WAN alias through the local SOCKS proxy:

```bash
ssh -o 'ProxyCommand=nc -X 5 -x 127.0.0.1:7897 %h %p' ai-wan '<cmd>'
```

Verify with `ssh ai 'hostname; date'` first, then with the WAN proxy command if
needed. If both fail but the user's terminal succeeds, treat the sandbox result
as irrelevant for remote reachability and stop to report that the local terminal
route is required. Do not invent raw SSH hosts, open iTerm, or create new tunnel
plans.

## Security baseline

- Never write real hostnames, tokens, passwords, private key paths, or remote
  deployment paths into public docs, commits, PRs, release notes, or reusable
  examples.
- Keep real connection material in `CLAUDE.local.md`, shell environment,
  `~/.ssh/config`, or another ignored local config file.
- Public examples may use the SSH aliases `ai` and `ai-wan` plus the documented
  local SOCKS proxy port. The actual host, user, key, token, and deployment path
  values must remain local-only.

## Verify the route

Verify before changing anything:

```bash
ssh ai 'hostname; date'
```

If direct SSH is unavailable, verify WAN through the proxy:

```bash
ssh -o 'ProxyCommand=nc -X 5 -x 127.0.0.1:7897 %h %p' ai-wan 'hostname; date'
```

Codex should not replace these with lower-level SSH host or port templates in
public docs. The aliases are resolved by the user's local SSH config.

## Run subsequent commands

After verification, run remote commands directly through the same alias:

```bash
ssh ai '<cmd>'
```

For WAN:

```bash
ssh -o 'ProxyCommand=nc -X 5 -x 127.0.0.1:7897 %h %p' ai-wan '<cmd>'
```

For multi-line remote work, write a temporary local script or here-doc and send
it through the alias. Keep the script free of secrets. If local terminal
automation is required to escape sandbox networking, tee the output to a local
temporary log so the agent can read and summarize the result.

## Debugging sequence

1. Verify direct route: run `ssh ai 'hostname; date'`.
2. If direct route fails, verify WAN proxy route with
   `ssh -o 'ProxyCommand=nc -X 5 -x 127.0.0.1:7897 %h %p' ai-wan 'hostname; date'`.
3. Read-only confirmation: check VoScript version, image tag or branch,
   container status, health endpoint, and disk/GPU pressure before changing
   anything.
4. Deploy or restart: run only the agreed deployment, compose, or service
   restart commands through the verified route.
5. Smoke test: confirm `/healthz`, the API auth path, and one minimal
   transcription or read-only API path as appropriate.
6. Log monitor: watch recent service/container logs long enough to catch
   startup failures, model-load errors, and worker crashes.

## Service identity and data checks

- The primary VoScript service is container/service `voscript` on port `8780`.
- Old candidate containers, candidate ports, or scratch deploys are not primary
  service failures unless the user explicitly asks to debug that candidate.
- For service health, prefer `GET /healthz` and `GET /openapi.json` on the
  primary service before drawing conclusions from Docker status alone.
- For counts, use API responses first. Do not infer current transcription or
  voiceprint counts from `voiceprints.db` alone.
- If counts disagree, verify the running process/container `DATA_DIR`, mounted
  volume, and API endpoint target before diagnosing data loss.
- Do not delete persisted voiceprints, transcriptions, models, or AS-norm cohort
  files unless the user explicitly asks for destructive cleanup.

## Remote deployment safety sequence

Before overwriting a remote VoScript checkout:

1. Read `git status --short --branch`, current branch, and recent commit.
2. If tracked or untracked source/test files are dirty, preserve them first:

   ```bash
   mkdir -p tmp/deploy-backups
   stamp=$(date +%Y%m%d-%H%M%S)
   git status --short > "tmp/deploy-backups/pre-deploy-$stamp.status.txt"
   git diff > "tmp/deploy-backups/pre-deploy-$stamp.patch" || true
   git stash push -u -m "pre-deploy-$stamp" || true
   ```

3. Only after the backup/stash exists, update to the intended public release
   branch or merge commit.
4. Do not run broad cleanup commands that delete ignored validation artifacts or
   persisted runtime data unless the user explicitly asks for destructive
   cleanup.
5. Report the backup patch/status paths and stash name, but do not paste private
   diffs into public text.

## Post-deploy smoke and monitoring

After restart or rebuild:

1. Wait for the container/service to become ready. A health check immediately
   after `docker compose up -d` can fail during cold start; retry before calling
   the deploy failed.
2. Verify `GET /healthz`.
3. Verify `GET /openapi.json` and confirm the expected public version.
4. Start a persistent log monitor in an ignored path, for example:

   ```bash
   nohup docker logs -f --tail=200 voscript > tmp/live-monitor.log 2>&1 &
   ```

5. Tail the monitor log and confirm no startup crash, model-load error, worker
   crash, or repeated auth/config error appears.
6. If AS-norm or voiceprint behavior is part of the release, confirm the logs
   show cohort load or rebuild, using counts only in private notes when needed.

## Client URL scheme check

If a public or LAN client URL on the service port returns:

```text
400 The plain HTTP request was sent to HTTPS port
```

retry the same host and port with `https://`. Report the working scheme to the
operator, but do not copy private hostnames into public docs or release notes.

## Close the session

No GUI terminal or persistent local tunnel is opened by default, so there is
usually nothing to close. If the user manually started a tunnel, ask before
stopping it.

## Common failures

### No route to host, timeout, or connection refused

1. Try the WAN proxy route if direct `ssh ai` failed.
2. Ask the user to verify local network/VPN/WAN connectivity and firewall
   access only after both documented routes fail.
3. Retry the verification command only after connectivity is restored.

### Alias not found or hostname cannot be resolved

1. Ask the user to confirm the alias exists in their local SSH config.
2. Do not ask for or publish the real host details.
3. Retry the direct or WAN proxy verification command.

### Remote host closed the connection

1. Retry the same route once.
2. If it fails again, try the other documented route.
3. Repeat the verification step before any deploy or restart command.

### Permission denied or key rejected

1. Ask the user to repair their local SSH credentials or agent state.
2. Do not paste private keys, passwords, or host details into public text.
3. Retry only after the user confirms local login works.

### known_hosts mismatch or first-use prompt

1. Stop automation until the user verifies the host fingerprint out of band.
2. Let the user update `known_hosts` locally.
3. Restart the background session and verify with `hostname; date`.
