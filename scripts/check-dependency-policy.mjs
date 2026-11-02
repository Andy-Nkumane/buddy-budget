import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const findDependencyPolicyFindings = ({ packageJson, qualityWorkflow, dependabot }) => {
  const findings = [];
  const manifest = JSON.parse(packageJson);

  if (manifest.scripts?.audit !== 'npm audit --audit-level=low')
    findings.push('package.json: npm audit must fail at low severity');
  if (!/^\s*fail-on-severity:\s*low\s*$/m.test(qualityWorkflow))
    findings.push('quality.yml: dependency review must fail at low severity');
  if (!/^\s*- run:\s*npm ci\s*$/m.test(qualityWorkflow))
    findings.push('quality.yml: CI must install the committed lockfile with npm ci');
  for (const ecosystem of ['npm', 'github-actions']) {
    if (!new RegExp(`package-ecosystem:\\s*${ecosystem}`).test(dependabot))
      findings.push(`dependabot.yml: ${ecosystem} updates are not monitored`);
  }
  if (/auto-?merge/i.test(dependabot))
    findings.push('dependabot.yml: dependency updates must not be auto-merged');

  return findings;
};

export const runDependencyPolicyChecks = (repositoryRoot) =>
  findDependencyPolicyFindings({
    packageJson: readFileSync(join(repositoryRoot, 'package.json'), 'utf8'),
    qualityWorkflow: readFileSync(
      join(repositoryRoot, '.github', 'workflows', 'quality.yml'),
      'utf8',
    ),
    dependabot: readFileSync(join(repositoryRoot, '.github', 'dependabot.yml'), 'utf8'),
  });

const scriptPath = fileURLToPath(import.meta.url);
if (resolve(process.argv[1] ?? '') === scriptPath) {
  const findings = runDependencyPolicyChecks(resolve(dirname(scriptPath), '..'));
  if (findings.length > 0) {
    console.error(findings.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Dependency security policy checks passed.');
  }
}
