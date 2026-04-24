# VoScript Remote Debugging

Use this minimal runbook for every remote VoScript debugging session. The user
opens a persistent SSH session from their local terminal first; Codex then runs
all follow-up commands through the configured SSH alias.

## Non-negotiable rule

Do not debug VoScript remote hosts from an isolated tool network if the operator
has already said the usable route is their local terminal. The fixed connection
contract is:

```bash
ssh -fN ai
```

or, for the WAN route:

```bash
ssh -fN ai-wan
```

Then verify with `ssh ai 'hostname; date'` or `ssh ai-wan 'hostname; date'`.
If the agent sandbox says "no route" but the user's terminal succeeds, treat the
sandbox result as irrelevant for remote reachability. Use the available
user-terminal bridge/session to run the same alias commands, or stop and report
that the local terminal route is required. Do not invent raw SSH hosts, manual
port-forward recipes, or multi-step tunnel plans.

## Security baseline

- Never write real hostnames, tokens, passwords, private key paths, or remote
  deployment paths into public docs, commits, PRs, release notes, or reusable
  examples.
- Keep real connection material in `CLAUDE.local.md`, shell environment,
  `~/.ssh/config`, or another ignored local config file.
- Public examples may use the local SSH aliases `ai` and `ai-wan`, but the
  actual host, user, port, key, and token values must remain local-only.

## Start the remote session

Before remote debugging, ask the user to run one of these commands in their own
terminal:

```bash
ssh -fN ai
```

Use the WAN alias when debugging over the external route:

```bash
ssh -fN ai-wan
```

Codex should not replace these with lower-level SSH host or port templates in
public docs. The aliases are resolved by the user's local SSH config.

If a persistent session is already open and `ssh ai 'hostname; date'` succeeds,
do not ask the user to redo setup. Continue with the verified alias.

## Verify the session

Verify before changing anything:

```bash
ssh ai 'hostname; date'
```

For WAN:

```bash
ssh ai-wan 'hostname; date'
```

## Run subsequent commands

After verification, run remote commands directly through the same alias:

```bash
ssh ai '<cmd>'
```

For WAN:

```bash
ssh ai-wan '<cmd>'
```

For multi-line remote work, write a temporary local script or here-doc and send
it through the alias. Keep the script free of secrets. If local terminal
automation is required to escape sandbox networking, tee the output to a local
temporary log so the agent can read and summarize the result.

## Debugging sequence

1. Connect: ask the user to run `ssh -fN ai` or `ssh -fN ai-wan`.
2. Verify: run `ssh ai 'hostname; date'` or `ssh ai-wan 'hostname; date'`.
3. Read-only confirmation: check VoScript version, image tag or branch,
   container status, health endpoint, and disk/GPU pressure before changing
   anything.
4. Deploy or restart: run only the agreed deployment, compose, or service
   restart commands through `ssh ai '<cmd>'` or `ssh ai-wan '<cmd>'`.
5. Smoke test: confirm `/healthz`, the API auth path, and one minimal
   transcription or read-only API path as appropriate.
6. Log monitor: watch recent service/container logs long enough to catch
   startup failures, model-load errors, and worker crashes.
7. Cleanup: close the background SSH session when finished, or explicitly note
   that it is being kept for continued debugging.

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

List persistent SSH sessions if needed:

```bash
ps aux | grep 'ssh -fN'
```

Close the internal route:

```bash
pkill -f 'ssh -fN ai'
```

Close the WAN route:

```bash
pkill -f 'ssh -fN ai-wan'
```

If `pkill` would be too broad for the local machine, use the process list and
kill only the exact matching SSH process.

## Common failures

### No route to host, timeout, or connection refused

1. Confirm the user started the correct alias: `ai` for internal route or
   `ai-wan` for WAN.
2. Ask the user to verify local network/VPN/WAN connectivity and firewall
   access.
3. Retry the verification command only after connectivity is restored.

### Alias not found or hostname cannot be resolved

1. Ask the user to confirm the alias exists in their local SSH config.
2. Do not ask for or publish the real host details.
3. Retry `ssh ai 'hostname; date'` or `ssh ai-wan 'hostname; date'`.

### Remote host closed the connection

1. Treat the background SSH session as stale.
2. Ask the user to start it again with `ssh -fN ai` or `ssh -fN ai-wan`.
3. Repeat the verification step before any deploy or restart command.

### Permission denied or key rejected

1. Ask the user to repair their local SSH credentials or agent state.
2. Do not paste private keys, passwords, or host details into public text.
3. Retry only after the user confirms local login works.

### known_hosts mismatch or first-use prompt

1. Stop automation until the user verifies the host fingerprint out of band.
2. Let the user update `known_hosts` locally.
3. Restart the background session and verify with `hostname; date`.
