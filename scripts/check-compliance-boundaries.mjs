import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const allowedEnvironmentFiles = new Set(['.env.example']);
const browserExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);
const forbiddenClientVariable =
  /\bVITE_(?=[A-Z0-9_]*(?:SECRET|PASSWORD|PRIVATE|SERVICE_ROLE|SMTP|MAILJET))[A-Z0-9_]+/g;

export const findTrackedEnvironmentFiles = (trackedFiles) =>
  trackedFiles.filter((file) => {
    const name = file.split('/').at(-1) ?? '';
    return name.startsWith('.env') && !allowedEnvironmentFiles.has(name);
  });

const listBrowserFiles = (directory) => {
  if (!statSync(directory).isDirectory()) return [];

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listBrowserFiles(path);
    return browserExtensions.has(extname(entry.name)) ? [path] : [];
  });
};

export const findForbiddenClientVariables = (repositoryRoot) => {
  const sourceRoot = join(repositoryRoot, 'src');
  return listBrowserFiles(sourceRoot).flatMap((path) => {
    const content = readFileSync(path, 'utf8');
    return [...content.matchAll(forbiddenClientVariable)].map((match) => ({
      file: relative(repositoryRoot, path).replaceAll('\\', '/'),
      variable: match[0],
    }));
  });
};

export const runComplianceBoundaryChecks = (repositoryRoot, trackedFiles) => {
  const failures = [];
  const trackedEnvironmentFiles = findTrackedEnvironmentFiles(trackedFiles);
  if (trackedEnvironmentFiles.length > 0) {
    failures.push(`COMP-017: tracked environment files: ${trackedEnvironmentFiles.join(', ')}`);
  }

  const forbiddenVariables = findForbiddenClientVariables(repositoryRoot);
  if (forbiddenVariables.length > 0) {
    failures.push(
      `COMP-017: server-only credential names referenced by browser code: ${forbiddenVariables
        .map(({ file, variable }) => `${file} (${variable})`)
        .join(', ')}`,
    );
  }

  return failures;
};

const scriptPath = fileURLToPath(import.meta.url);
if (resolve(process.argv[1] ?? '') === scriptPath) {
  const repositoryRoot = resolve(dirname(scriptPath), '..');
  const trackedFiles = execFileSync('git', ['ls-files'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  })
    .split(/\r?\n/)
    .filter(Boolean);
  const failures = runComplianceBoundaryChecks(repositoryRoot, trackedFiles);

  if (failures.length > 0) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Compliance boundary checks passed (COMP-017).');
  }
}
