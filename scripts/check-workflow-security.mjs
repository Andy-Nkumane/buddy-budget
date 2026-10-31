import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const actionPin = /^[^\s@]+\/[^\s@]+@[a-f0-9]{40}$/;
const allowedSecretReferences = new Set(['GITHUB_TOKEN']);
const privilegedBrowserVariable =
  /\bVITE_(?=[A-Z0-9_]*(?:SECRET|PASSWORD|PRIVATE|SERVICE_ROLE|SMTP|MAILJET))[A-Z0-9_]+/g;

export const findWorkflowContentFindings = (file, content) => {
  const findings = [];
  if (/^\s*pull_request_target\s*:/m.test(content))
    findings.push(`${file}: pull_request_target requires a separate threat review`);
  if (/^permissions:\s+(?:read-all|write-all)\s*$/m.test(content))
    findings.push(`${file}: broad workflow permissions are forbidden`);

  for (const match of content.matchAll(/^\s*-?\s*uses:\s*([^\s#]+).*$/gm)) {
    const reference = match[1];
    if (reference.startsWith('./') || reference.startsWith('docker://')) continue;
    if (!actionPin.test(reference))
      findings.push(`${file}: external action is not pinned to a full commit SHA (${reference})`);
  }
  for (const match of content.matchAll(/\$\{\{\s*secrets\.([A-Z0-9_]+)\s*\}\}/g)) {
    if (!allowedSecretReferences.has(match[1]))
      findings.push(`${file}: long-lived secret reference requires an explicit policy review`);
  }
  for (const match of content.matchAll(privilegedBrowserVariable))
    findings.push(`${file}: privileged credential name uses the public VITE_ prefix (${match[0]})`);
  return findings;
};

const parseJobPermissions = (content) => {
  const jobs = new Map();
  const lines = content.split(/\r?\n/);
  let inJobs = false;
  let currentJob = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === 'jobs:') {
      inJobs = true;
      continue;
    }
    if (!inJobs) continue;
    const job = /^  ([a-zA-Z0-9_-]+):\s*$/.exec(line);
    if (job) {
      currentJob = job[1];
      jobs.set(currentJob, null);
      continue;
    }
    if (!currentJob) continue;
    if (line === '    permissions: {}') {
      jobs.set(currentJob, {});
      continue;
    }
    if (line === '    permissions:') {
      const permissions = {};
      for (let permissionIndex = index + 1; permissionIndex < lines.length; permissionIndex += 1) {
        const permission = /^      ([a-z-]+):\s*(read|write|none)\s*$/.exec(lines[permissionIndex]);
        if (!permission) break;
        permissions[permission[1]] = permission[2];
        index = permissionIndex;
      }
      jobs.set(currentJob, permissions);
    }
  }
  return jobs;
};

const expectedPermissions = {
  'quality.yml': {
    secrets: { contents: 'read' },
    web: { contents: 'read' },
    database: { contents: 'read' },
    'quality-gate': {},
  },
  'pages.yml': {
    build: { contents: 'read' },
    deploy: { pages: 'write', 'id-token': 'write' },
  },
};

export const findWorkflowPermissionFindings = (file, content) => {
  const findings = [];
  if (!/^permissions:\s*\{\}\s*$/m.test(content))
    findings.push(`${file}: workflow permissions must default to none`);
  const jobs = parseJobPermissions(content);
  const reviewedPermissions = expectedPermissions[file] ?? {};
  for (const job of jobs.keys()) {
    if (!(job in reviewedPermissions))
      findings.push(`${file}: ${job} has no reviewed least-privilege policy`);
  }
  for (const [job, expected] of Object.entries(reviewedPermissions)) {
    const actual = jobs.get(job);
    if (JSON.stringify(actual) !== JSON.stringify(expected))
      findings.push(`${file}: ${job} permissions differ from the reviewed least-privilege policy`);
  }
  if (
    file === 'pages.yml' &&
    !content.includes("github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'")
  )
    findings.push(`${file}: manual deployment is not restricted to main`);
  return findings;
};

export const runWorkflowSecurityChecks = (repositoryRoot) => {
  const workflowRoot = join(repositoryRoot, '.github', 'workflows');
  return readdirSync(workflowRoot)
    .filter((file) => /\.ya?ml$/.test(file))
    .flatMap((file) => {
      const content = readFileSync(join(workflowRoot, file), 'utf8');
      return [
        ...findWorkflowContentFindings(file, content),
        ...findWorkflowPermissionFindings(file, content),
      ];
    });
};

const scriptPath = fileURLToPath(import.meta.url);
if (resolve(process.argv[1] ?? '') === scriptPath) {
  const findings = runWorkflowSecurityChecks(resolve(dirname(scriptPath), '..'));
  if (findings.length > 0) {
    console.error(findings.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Workflow credential policy checks passed.');
  }
}
