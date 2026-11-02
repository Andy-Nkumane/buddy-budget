# Dependency security

Buddy Budget blocks known npm advisories at every severity. The lockfile is authoritative and CI
installs it with `npm ci` before running `npm audit --audit-level=low`. Pull requests that change the
dependency graph are also reviewed at low severity by GitHub's dependency-review action.

## Update policy

Dependabot checks npm and GitHub Actions weekly. It groups compatible minor and patch npm updates,
but it does not merge them. Every update must pass the normal review and quality gates. Major
updates remain separate so their compatibility and migration requirements are visible.

GitHub Actions remain pinned to full commit SHAs. For an Action update, verify the proposed commit
against its upstream release tag, review the release notes and commit diff, retain the version
comment beside the SHA, and run the workflow-policy test. A semantic tag is useful for finding a
release but is not an acceptable workflow pin.

## Transitive constraints

The root overrides constrain build and lint dependency trees to published versions outside current
advisory ranges. They are not advisory exceptions. Before changing or removing an override:

1. Check whether every parent package now resolves a non-vulnerable version without it.
2. Run `npm ci` and `npm audit --audit-level=low`.
3. Run lint, unit tests, the production/PWA build, and relevant browser tests.
4. Review the lockfile to confirm the override did not create duplicate or incompatible trees.

If any advisory has no compatible remediation, the release is blocked until the dependency is
removed, replaced, or upstream publishes a fix. Do not add audit allowlists, lower the severity
threshold, or use `npm audit fix --force`.

## Local verification

```bash
npm ci
npm audit --audit-level=low
npm run lint
npm test
npm run build
```

Use `npm audit --json` for investigation only. Audit reports can contain environment and dependency
details and must not be committed as generated evidence.
