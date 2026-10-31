# Secret scanning and security CI

## Enforced checks

The `Quality` workflow runs three required jobs and combines their results in the final quality
gate:

- `secrets` scans committed history with the default gitleaks rules, verifies representative
  positive and negative fixtures, and reviews pull-request dependency changes at high severity.
- `web` runs formatting, lint, type checking, unit and compliance tests, dependency audit,
  production builds, and public browser tests.
- `database` starts an isolated local Supabase stack and runs migrations and pgTAP tests.

Known npm vulnerabilities are blocked at low severity and dependency changes receive the same
threshold in pull requests. Dependabot monitors npm and GitHub Actions without auto-merge. See the
[dependency security policy](dependency-security.md).

Workflow permissions default to none and are granted per job. The Pages build has read-only source
access; only the deploy job receives short-lived Pages and OIDC permissions. The workflow-policy
test rejects mutable Action tags, `pull_request_target`, unreviewed secret references, privileged
`VITE_` names, and permission drift. See [workflow credentials](workflow-credentials.md).

Security-sensitive GitHub Actions are pinned to reviewed commit SHAs. The adjacent version comments
record the upstream release used; updating an Action requires checking the new upstream tag, reviewing
its release notes and diff, replacing the SHA, and rerunning the workflow.

## Local commands

Run these through WSL from the repository root:

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:compliance
npm run audit
npm run build
npm run test:secrets
npm run test:workflows
npm run check:artifacts
```

`npm run test:secrets` requires Docker. It creates fixtures in the operating-system temporary
directory, confirms that a generated fake credential is detected, confirms that an innocuous
high-entropy artifact digest is accepted, and then removes both fixtures. No credential fixture is
committed or printed.

To scan committed history without printing matched values:

```bash
docker run --rm -v "$PWD:/repo:ro" zricethezav/gitleaks@sha256:e1b35e12a8c6fa8901f060459cfb6b2fc4c484d3afbe3b029733a3bbfab07055 git /repo --config=/repo/.gitleaks.toml --redact --no-banner --log-opts="--all"
```

## Triage and remediation

Treat scanner output as a finding to investigate, not automatic proof of a live credential.

1. Do not paste or publish the matched value. Record only the rule, file, line, and redacted
   fingerprint.
2. Classify it as a verified secret, likely secret, or false positive using format, provenance,
   context, and authorised non-disclosing checks.
3. For a verified or likely secret, revoke or rotate it before removing it from current files. Ask
   the repository owner before rewriting Git history, and assume forks or clones may retain it.
4. For a false positive, prefer changing ambiguous documentation or synthetic data. Add an
   allowlist only when evidence is documented, and constrain it by both path and exact content where
   the scanner supports that combination.
5. Never allowlist an entire environment file, credential directory, broad token pattern, or
   high-risk file type.

Supabase publishable and legacy anonymous keys are designed for browser use but remain
configuration-sensitive. Supabase service-role keys, database passwords, JWT secrets, SMTP
credentials, OAuth client secrets, personal access tokens, and deployment credentials must never be
stored in browser-prefixed variables or committed files.

## Environment and logs

Only `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_BASE_PATH` are expected in the
browser build. Every `VITE_` value is public. Hosted Edge Function secrets belong in Supabase secret
configuration; GitHub deployment credentials belong in GitHub environment secrets. Current Edge
Function error logging records fixed error messages rather than request bodies, tokens, or financial
payloads.
