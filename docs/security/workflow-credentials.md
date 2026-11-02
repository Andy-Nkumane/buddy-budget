# Workflow credentials and least-privilege deployment

## Verified repository boundary

Buddy Budget's GitHub workflows build and test the application and deploy the static site to GitHub
Pages. They do not deploy Supabase migrations, Edge Functions, Auth settings, Vault values, or
Mailjet configuration. Production Supabase changes remain a reviewed manual operation because the
repository has no verified provider-supported GitHub OIDC exchange for those operations.

`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are public browser configuration. GitHub
Actions variables are used for configuration management, not secrecy. Every value prefixed with
`VITE_` is embedded in the public build.

## Credential inventory

| Credential or value           | Purpose and issuer                                                               | Lifetime and scope                                                            | Storage and consumer                                                                   | Rotation or revocation                                                                             | Classification                                                          |
| ----------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Job `GITHUB_TOKEN`            | GitHub issues it to a workflow job for repository API access                     | Job-scoped and expires after the job; `contents: read` in the secret-scan job | Injected by GitHub only into the gitleaks step                                         | Cancel the run, disable the workflow, or revoke repository access; GitHub expires it automatically | Ephemeral secret                                                        |
| Pages OIDC token              | GitHub issues an identity assertion used by the official Pages deployment action | Deploy-job only; `id-token: write`                                            | Runtime only; consumed by `actions/deploy-pages`                                       | Cancel the run, restrict the `github-pages` environment, or disable Pages/workflow access          | Ephemeral credential                                                    |
| Pages deployment permission   | GitHub authorizes the official deployment action                                 | Deploy-job only; `pages: write`                                               | Workflow job permission, not a stored token                                            | Remove the permission, protect the environment, or disable the workflow                            | Ephemeral authorization                                                 |
| Supabase project URL          | Identifies the configured Supabase API                                           | Environment-specific and public                                               | GitHub Actions variable and browser bundle                                             | Change the variable when the project endpoint changes                                              | Public configuration                                                    |
| Supabase publishable key      | Identifies a public client whose access is constrained by RLS                    | Public and environment-specific                                               | GitHub Actions variable and browser bundle                                             | Rotate in Supabase if operationally required, then update the variable                             | Public configuration-sensitive value                                    |
| Supabase CLI access token     | Authenticates manual CLI management                                              | Provider-controlled; scopes depend on the account/token                       | Not referenced by workflows; approved operator secret store only                       | Revoke in Supabase account settings, review activity, and issue a narrower replacement             | Long-lived provider secret; automatic invisible issuance is **BLOCKED** |
| Database password             | Direct database administration and migration fallback                            | Provider-controlled                                                           | Not referenced by workflows; approved operator secret store or interactive prompt only | Rotate in Supabase, update approved clients, and review database access                            | Long-lived provider secret                                              |
| Supabase service-role key     | Server-side RLS-bypassing Edge Function access                                   | Project-wide privileged key                                                   | Supabase Edge Function secrets and Vault only; never GitHub Pages or Vite              | Rotate in Supabase, update server-side consumers, and inspect logs                                 | High-privilege long-lived secret                                        |
| Mailjet API and secret keys   | Sends opted-in weekly check-in email                                             | Provider/account scope                                                        | Supabase Edge Function secrets only                                                    | Revoke/rotate in Mailjet, update Supabase secrets, and test staging delivery                       | Long-lived provider secrets                                             |
| Cron/Vault service-role value | Authorizes scheduled Edge Function dispatch                                      | Project-wide privileged key                                                   | Supabase Vault only                                                                    | Rotate the service-role key and update Vault through an approved session                           | High-privilege long-lived secret                                        |
| Local Supabase keys           | Local development and disposable tests                                           | Local stack lifetime                                                          | Local ignored environment files or CLI output                                          | Stop/reset the local stack; never reuse in hosted environments                                     | Local-only test credentials                                             |

No personal access token, Pages deployment token, production database credential, service-role key,
Mailjet credential, or Supabase access token is required by the current GitHub workflows.

## Workflow permission policy

- Workflow permissions default to none.
- Quality jobs receive only `contents: read`; the final gate receives no token permissions.
- The Pages build receives only `contents: read`.
- Only the Pages deploy job receives `pages: write` and `id-token: write`.
- Manual Pages deployment is restricted to `main`.
- Pull requests, including forks and Dependabot pull requests, receive no long-lived deployment or
  provider secret. The public Vite configuration may be present because it is not privileged.
- `pull_request_target` is forbidden without a separate threat review.
- External actions must be pinned to reviewed 40-character commit SHAs.

`npm run test:workflows` enforces these repository rules. `npm run check:artifacts` scans the
production output for privileged credential names and secret formats without printing matched
values.

## GitHub configuration required

Repository code cannot prove hosted settings. An owner must verify and retain dated, secret-free
evidence that:

1. the `github-pages` environment is limited to `main` and has appropriate reviewers;
2. GitHub Pages uses GitHub Actions as its source;
3. workflow permissions are not overridden by an unnecessarily broad organization policy;
4. fork pull requests cannot access environment secrets;
5. Dependabot cannot deploy or access environment secrets;
6. branch protection requires the `Quality gate` before merge;
7. administrators and workflow maintainers use MFA and least-privilege repository roles; and
8. no unused Actions, environment, repository, or organization secret remains configured.

Do not store screenshots containing token values, provider secrets, private email addresses, or
financial data. Record the repository, environment, reviewer, date, observed setting, result, and a
restricted evidence location.

## Supabase and other providers

Automatic credentialless Supabase CLI deployment is **BLOCKED** until Supabase documents and the
team verifies an OIDC integration that supports this repository's exact migration and Edge Function
workflow. Do not invent a token exchange or persist a GitHub OIDC assertion.

Keep production Supabase deployment manual. If a future reviewed workflow genuinely needs a
provider secret, use a protected GitHub Environment, minimum provider scope, required reviewers,
branch restrictions, masking, an owner, an expiry/rotation date, and a tested revocation procedure.
Update `test:workflows` deliberately in the same reviewed change; do not bypass it.

## Rotation and emergency revocation

For suspected exposure:

1. Stop the affected workflow or deployment without printing the value.
2. Classify the value as public configuration, ephemeral credential, or long-lived secret.
3. Revoke or rotate a verified or likely long-lived secret at its issuer before repository cleanup.
4. Review provider and GitHub audit evidence available to the plan.
5. Rebuild and redeploy only after workflow, secret, artifact, and authorization checks pass.
6. Follow the incident-response playbook if personal or financial information may have been
   accessed.

Do not rotate the publishable key as though its visibility alone were a secret incident. Verify RLS
and rotate it only for an actual operational reason.

## Action update process

For every pinned Action update:

1. Verify the upstream repository and release tag.
2. Review release notes, permissions, inputs, network behavior, and the diff between pinned commits.
3. Replace the full SHA and keep the adjacent human-readable version comment.
4. Run workflow-policy, secret, build-artifact, and normal quality checks.
5. Merge through normal review; never auto-merge a pin update solely because Dependabot opened it.
