# Privacy and Anonymization Baseline

Use this checklist before changing public VoScript docs, examples, scripts, or skill text.

## Public-safe

- API endpoint names, request fields, response shapes, and generic error categories.
- Environment variable names such as `VOSCRIPT_URL` and `VOSCRIPT_API_KEY`.
- Placeholder examples such as `<API_KEY>`, `<tr_id>`, `<speaker_id>`, and `<job_id>`.
- Anonymized validation wording such as "internal live validation" or "internal benchmark set".
- Synthetic example speaker names that cannot be mistaken for real users, hosts, files, or meetings.

## Public-safe only after anonymization

- Metrics from internal validation, if they do not expose file names, meeting titles, hostnames, paths, ports, job IDs, speaker IDs, or dataset names.
- Failure examples, if all identifiers are placeholders and logs are reduced to the user-visible error class.
- Export examples, if speaker names and transcript text are synthetic.

## Local-only

Keep these only in ignored local files, `CLAUDE.local.md`, private notes, or private test artifacts:

- Internal planning files, long-term direction documents, and roadmap directories.
- Raw validation logs, JSON results, screenshots, and batch outputs.
- Real audio/video corpus names, file names, meeting titles, or transcript excerpts.
- Real job IDs, speaker IDs, upload IDs, transcription IDs, hostnames, ports, remote paths, and deployment names.
- API keys, tokens, passwords, SSH addresses, server paths, and key storage locations.
- Machine-specific absolute paths such as a user's home directory.

## Public release scan

Before publishing, scan tracked files for these categories and remove or anonymize any hit:

- `roadmap`, `tmp/E2E_sound`, real corpus names, and real media file names.
- `tr_`, `spk_`, concrete ports, remote host aliases, and remote deployment paths.
- `/Users/`, `/data/`, `.env`, `CLAUDE.local.md`, keys, tokens, and passwords.
- Phrases that imply a private dataset name, such as "private corpus" or "private sample".

If a detail is useful only for local operation or internal validation, do not publish it. Put it in a local ignored file instead.
