import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findWorkflowContentFindings } from './check-workflow-security.mjs';

test('accepts a full-SHA action pin and the ephemeral GitHub token', () => {
  const content = `
steps:
  - uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803
    env:
      GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`;
  assert.deepEqual(findWorkflowContentFindings('safe.yml', content), []);
});

test('rejects mutable action tags and pull_request_target', () => {
  const findings = findWorkflowContentFindings(
    'unsafe.yml',
    'pull_request_target:\nsteps:\n  - uses: actions/checkout@v6\n',
  );
  assert.equal(findings.length, 2);
});

test('rejects long-lived secret references and privileged browser names', () => {
  const findings = findWorkflowContentFindings(
    'unsafe.yml',
    'env:\n  TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}\n  VITE_SUPABASE_SERVICE_ROLE_KEY: value\n',
  );
  assert.equal(findings.length, 2);
});
