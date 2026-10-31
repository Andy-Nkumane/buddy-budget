import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findDependencyPolicyFindings } from './check-dependency-policy.mjs';

const securePolicy = {
  packageJson: JSON.stringify({ scripts: { audit: 'npm audit --audit-level=low' } }),
  qualityWorkflow: '- run: npm ci\n  fail-on-severity: low\n',
  dependabot: 'package-ecosystem: npm\npackage-ecosystem: github-actions\n',
};

test('accepts the zero-known-vulnerability policy', () => {
  assert.deepEqual(findDependencyPolicyFindings(securePolicy), []);
});

test('rejects weaker audit and dependency-review thresholds', () => {
  const findings = findDependencyPolicyFindings({
    ...securePolicy,
    packageJson: JSON.stringify({ scripts: { audit: 'npm audit --audit-level=high' } }),
    qualityWorkflow: '- run: npm install\n  fail-on-severity: high\n',
  });
  assert.equal(findings.length, 3);
});

test('rejects missing update coverage and auto-merge configuration', () => {
  const findings = findDependencyPolicyFindings({
    ...securePolicy,
    dependabot: 'package-ecosystem: npm\nauto-merge: true\n',
  });
  assert.equal(findings.length, 2);
});
