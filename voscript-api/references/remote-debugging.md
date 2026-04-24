# VoScript Remote Debugging

Use this minimal runbook for every remote VoScript debugging session. The user
opens a persistent SSH session from their local terminal first; Codex then runs
all follow-up commands through the configured SSH alias.

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
