# Privacy and Anonymization Baseline

Use this checklist before changing public VoScript docs, examples, scripts, or skill text.

## Public-safe

- API endpoint names, request fields, response shapes, and generic error categories.
- Environment variable names such as `VOSCRIPT_URL` and `VOSCRIPT_API_KEY`.
- Placeholder examples such as `<API_KEY>`, `<tr_id>`, `<speaker_id>`, and `<job_id>`.
- Anonymized validation wording such as "internal live validation" or "internal benchmark set".
- Synthetic example speaker names that cannot be mistaken for real users, hosts, files, or meetings.
- The abstract "documented direct SSH alias / WAN ProxyCommand flow" wording
  inside this skill's remote-debugging runbook. The actual alias names, proxy
  address, proxy port, host, user, key, path, and token material remain
  local-only.

## Public-safe only after anonymization

- Metrics from internal validation, if they do not expose file names, meeting titles, hostnames, paths, ports, job IDs, speaker IDs, or dataset names.
- Failure examples, if all identifiers are placeholders and logs are reduced to the user-visible error class.
- Export examples, if speaker names and transcript text are synthetic.

## Local-only

Keep these only in ignored local files, ignored operator config, private notes, or private test artifacts:

- Internal planning files, long-term direction documents, and private planning directories.
- Raw validation logs, JSON results, screenshots, and batch outputs.
- Real audio/video corpus names, file names, meeting titles, or transcript excerpts.
- Real job IDs, speaker IDs, upload IDs, transcription IDs, hostnames, ports, remote paths, and deployment names.
- API keys, tokens, passwords, SSH addresses, server paths, and key storage locations.
- Machine-specific absolute paths such as a user's home directory.

## Public release scan

Before publishing, scan tracked files and remove or anonymize any hit:

```bash
python voscript-api/scripts/public_release_scan.py --root <REPO_ROOT>
```

The helper reports `file:line`, category, excerpt, and remediation advice. Treat any
hit as blocking until reviewed.

It checks these categories:

- Private planning directories, internal validation material directories, real corpus names, and real media file names.
- `tr_`, `spk_`, concrete ports, private remote host aliases, and remote deployment paths.
- Machine-local absolute path prefixes, environment files, local agent config,
  keys, tokens, and passwords.
- Phrases that imply a named private dataset, sample set, or validation corpus.

If a detail is useful only for local operation or internal validation, do not publish it. Put it in a local ignored file instead.

## Release-report wording

Use short anonymized evidence in public docs:

- Good: "internal live validation completed"
- Good: "internal benchmark set completed without failures"
- Good: "new-voice AS-norm validation covered enroll, cohort rebuild, probe hit, and cleanup"
- Bad: real corpus directory names, meeting titles, private host aliases, debug ports, job IDs, speaker IDs, or raw transcript snippets

For AS-norm validation, keep the full sample selection and job/speaker identifiers in local-only notes. Public reports should state the behavior that was verified, not the private material used to verify it.
